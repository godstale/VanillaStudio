use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use super::fs_commands::resolve_and_verify_workspace_path;

const SCENES_DIR: &str = "scenes";
const TRASH_DIR: &str = ".vanilla/trash";
// 신 폴더 트리(Technical-Design §9). scene.json·GUIDE.md·AGENTS.md는 앱이 렌더해 따로 쓴다.
const SCENE_SUBDIRS: &[&str] = &["src", "params", "prompts", "references/analysis", ".vanilla"];

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SceneInfo {
    pub slug: String,
    pub scene_id: String,
    pub dir: String,
}

/// 이름 → 폴더 slug. ASCII 영숫자만 남기고 나머지는 `-`로 합친다. 비면 `scene`.
pub fn slugify(name: &str) -> String {
    let mut s = String::new();
    for c in name.chars().flat_map(|c| c.to_lowercase()) {
        if c.is_ascii_alphanumeric() {
            s.push(c);
        } else if !s.ends_with('-') && !s.is_empty() {
            s.push('-');
        }
    }
    let s = s.trim_end_matches('-').to_string();
    if s.is_empty() { "scene".into() } else { s }
}

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.len() <= 80
        && slug.chars().next().is_some_and(|c| c.is_ascii_alphanumeric())
        && slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn new_scene_id() -> String {
    format!("scn_{:012x}", rand::random::<u64>() & 0xffff_ffff_ffff)
}

fn unique_slug(scenes: &Path, base: &str) -> String {
    if !scenes.join(base).exists() {
        return base.to_string();
    }
    (2..)
        .map(|n| format!("{base}-{n}"))
        .find(|s| !scenes.join(s).exists())
        .expect("infinite range")
}

fn display(p: &Path) -> String {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with(r"UNC\") => rest.to_string(),
        _ => s.to_string(),
    }
}

fn scenes_dir(root: &Path) -> PathBuf {
    root.join(SCENES_DIR)
}

fn scene_dir(root: &Path, slug: &str) -> Result<PathBuf, String> {
    if !valid_slug(slug) {
        return Err(format!("Invalid scene slug: {slug}"));
    }
    let dir = scenes_dir(root).join(slug);
    if !dir.is_dir() {
        return Err(format!("Scene not found: {slug}"));
    }
    Ok(dir)
}

fn create(root: &Path, name: &str) -> Result<SceneInfo, String> {
    if name.trim().is_empty() {
        return Err("Scene name must not be empty".into());
    }
    let scenes = scenes_dir(root);
    fs::create_dir_all(&scenes).map_err(|e| e.to_string())?;
    let slug = unique_slug(&scenes, &slugify(name));
    let dir = scenes.join(&slug);
    fs::create_dir(&dir).map_err(|e| e.to_string())?;
    for sub in SCENE_SUBDIRS {
        if let Err(e) = fs::create_dir_all(dir.join(sub)) {
            let _ = fs::remove_dir_all(&dir);
            return Err(e.to_string());
        }
    }
    Ok(SceneInfo { slug, scene_id: new_scene_id(), dir: display(&dir) })
}

fn rename(root: &Path, slug: &str, new_name: &str) -> Result<SceneInfo, String> {
    let from = scene_dir(root, slug)?;
    if new_name.trim().is_empty() {
        return Err("Scene name must not be empty".into());
    }
    let scenes = scenes_dir(root);
    let wanted = slugify(new_name);
    // 같은 slug로 바뀌면 폴더는 그대로 둔다(자기 자신과 충돌하지 않게).
    let new_slug = if wanted == slug { wanted } else { unique_slug(&scenes, &wanted) };
    if new_slug != slug {
        fs::rename(&from, scenes.join(&new_slug)).map_err(|e| e.to_string())?;
    }
    Ok(SceneInfo { slug: new_slug.clone(), scene_id: String::new(), dir: display(&scenes.join(&new_slug)) })
}

/// 영구 삭제 대신 `.vanilla/trash/<slug>-<epoch>/`로 옮긴다(복구 가능). 돌려주는 값은 옮긴 위치.
fn trash(root: &Path, slug: &str) -> Result<String, String> {
    let from = scene_dir(root, slug)?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let trash = root.join(TRASH_DIR);
    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
    let to = trash.join(format!("{slug}-{stamp}"));
    fs::rename(&from, &to).map_err(|e| e.to_string())?;
    Ok(display(&to))
}

fn copy_tree(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_symlink() {
            return Err(format!("Scene contains a symlink: {}", entry.path().display()));
        }
        let name = entry.file_name();
        // 앱 상태(.vanilla: 썸네일·이력)는 복제하지 않는다.
        if name == ".vanilla" {
            continue;
        }
        let target = dst.join(&name);
        if ft.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn duplicate(root: &Path, slug: &str, new_name: &str) -> Result<SceneInfo, String> {
    let from = scene_dir(root, slug)?;
    if new_name.trim().is_empty() {
        return Err("Scene name must not be empty".into());
    }
    let scenes = scenes_dir(root);
    let new_slug = unique_slug(&scenes, &slugify(new_name));
    let to = scenes.join(&new_slug);
    if let Err(e) = copy_tree(&from, &to) {
        let _ = fs::remove_dir_all(&to);
        return Err(e);
    }
    fs::create_dir_all(to.join(".vanilla")).map_err(|e| e.to_string())?;
    Ok(SceneInfo { slug: new_slug, scene_id: new_scene_id(), dir: display(&to) })
}

/// 워크스페이스 스코프를 검사하고 정규 루트를 돌려준다. `scenes/`가 밖을 가리키는 심링크면 거부된다.
fn checked_root(workspace_root: &str) -> Result<PathBuf, String> {
    let root = Path::new(workspace_root).canonicalize().map_err(|e| format!("Workspace '{workspace_root}': {e}"))?;
    let root_str = root.to_string_lossy().to_string();
    resolve_and_verify_workspace_path(SCENES_DIR, Some(&root_str), false)?;
    Ok(root)
}

#[tauri::command]
pub fn create_scene(workspace_root: String, name: String) -> Result<SceneInfo, String> {
    create(&checked_root(&workspace_root)?, &name)
}

/// 폴더만 바꾼다. `scene.json`의 `name`은 호출한 쪽이 정규화 직렬화로 갱신한다.
#[tauri::command]
pub fn rename_scene(workspace_root: String, slug: String, new_name: String) -> Result<SceneInfo, String> {
    rename(&checked_root(&workspace_root)?, &slug, &new_name)
}

#[tauri::command]
pub fn delete_scene(workspace_root: String, slug: String) -> Result<String, String> {
    trash(&checked_root(&workspace_root)?, &slug)
}

/// 폴더를 복사하고 새 `sceneId`를 발급한다. `scene.json`의 `id`·`name` 갱신은 호출한 쪽 몫이다.
#[tauri::command]
pub fn duplicate_scene(workspace_root: String, slug: String, new_name: String) -> Result<SceneInfo, String> {
    duplicate(&checked_root(&workspace_root)?, &slug, &new_name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    fn tree(dir: &Path) -> Vec<String> {
        let mut out = Vec::new();
        fn walk(base: &Path, dir: &Path, out: &mut Vec<String>) {
            for e in fs::read_dir(dir).unwrap() {
                let p = e.unwrap().path();
                let rel = p.strip_prefix(base).unwrap().to_string_lossy().replace('\\', "/");
                if p.is_dir() {
                    out.push(format!("{rel}/"));
                    walk(base, &p, out);
                } else {
                    out.push(rel);
                }
            }
        }
        walk(dir, dir, &mut out);
        out.sort();
        out
    }

    #[test]
    fn slugify_cases() {
        assert_eq!(slugify("Gangdong Forest!"), "gangdong-forest");
        assert_eq!(slugify("  --A  B--  "), "a-b");
        assert_eq!(slugify("강동 숲"), "scene");
        assert_eq!(slugify(""), "scene");
    }

    #[test]
    fn create_builds_the_tree_and_ids() {
        let r = root();
        let a = create(r.path(), "Intro").unwrap();
        assert_eq!(a.slug, "intro");
        assert!(a.scene_id.starts_with("scn_") && a.scene_id.len() == 16);
        assert_eq!(
            tree(&r.path().join("scenes/intro")),
            vec![".vanilla/", "params/", "prompts/", "references/", "references/analysis/", "src/"]
        );
    }

    #[test]
    fn slug_collisions_get_a_suffix_and_ids_differ() {
        let r = root();
        let a = create(r.path(), "Intro").unwrap();
        let b = create(r.path(), "intro").unwrap();
        let c = create(r.path(), "INTRO").unwrap();
        assert_eq!((b.slug.as_str(), c.slug.as_str()), ("intro-2", "intro-3"));
        assert_ne!(a.scene_id, b.scene_id);
        assert!(create(r.path(), "  ").is_err());
    }

    #[test]
    fn rename_moves_the_folder_and_avoids_collisions() {
        let r = root();
        create(r.path(), "A").unwrap();
        create(r.path(), "B").unwrap();
        fs::write(r.path().join("scenes/a/src/index.html"), "x").unwrap();
        assert_eq!(rename(r.path(), "a", "A").unwrap().slug, "a");
        assert_eq!(rename(r.path(), "a", "Brand New").unwrap().slug, "brand-new");
        assert!(r.path().join("scenes/brand-new/src/index.html").is_file());
        assert!(!r.path().join("scenes/a").exists());
        assert_eq!(rename(r.path(), "brand-new", "B").unwrap().slug, "b-2");
    }

    #[test]
    fn delete_moves_to_the_workspace_trash() {
        let r = root();
        create(r.path(), "Gone").unwrap();
        fs::write(r.path().join("scenes/gone/scene.json"), "{}").unwrap();
        let to = trash(r.path(), "gone").unwrap();
        assert!(!r.path().join("scenes/gone").exists());
        assert!(Path::new(&to).join("scene.json").is_file());
        assert!(to.replace('\\', "/").contains(".vanilla/trash/gone-"));
        assert!(trash(r.path(), "gone").is_err());
    }

    #[test]
    fn duplicate_copies_content_but_not_app_state() {
        let r = root();
        create(r.path(), "Src").unwrap();
        fs::write(r.path().join("scenes/src/src/index.html"), "hello").unwrap();
        fs::write(r.path().join("scenes/src/.vanilla/thumb.png"), "png").unwrap();
        let orig_id = create(r.path(), "Other").unwrap().scene_id;
        let d = duplicate(r.path(), "src", "Src copy").unwrap();
        assert_eq!(d.slug, "src-copy");
        assert_ne!(d.scene_id, orig_id);
        assert_eq!(fs::read_to_string(r.path().join("scenes/src-copy/src/index.html")).unwrap(), "hello");
        assert!(r.path().join("scenes/src-copy/.vanilla").is_dir());
        assert!(!r.path().join("scenes/src-copy/.vanilla/thumb.png").exists());
    }

    #[test]
    fn rejects_bad_or_unknown_slugs() {
        let r = root();
        create(r.path(), "A").unwrap();
        for bad in ["../a", "a/b", "", "A", "a b", "..", "a\\b"] {
            assert!(rename(r.path(), bad, "x").is_err(), "{bad}");
            assert!(trash(r.path(), bad).is_err(), "{bad}");
            assert!(duplicate(r.path(), bad, "x").is_err(), "{bad}");
        }
        assert!(rename(r.path(), "missing", "x").is_err());
    }

    #[test]
    fn commands_reject_a_missing_workspace_root() {
        assert!(create_scene("/definitely/not/here".into(), "x".into()).is_err());
    }

    #[test]
    fn scenes_symlink_escaping_the_workspace_is_rejected() {
        let r = root();
        let outside = root();
        let link = r.path().join("scenes");
        #[cfg(windows)]
        let made = std::os::windows::fs::symlink_dir(outside.path(), &link).is_ok();
        #[cfg(unix)]
        let made = std::os::unix::fs::symlink(outside.path(), &link).is_ok();
        if !made {
            return; // 심링크 권한 없음
        }
        assert!(create_scene(r.path().to_string_lossy().to_string(), "x".into()).is_err());
        assert!(tree(outside.path()).is_empty());
    }
}
