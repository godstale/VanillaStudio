import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import require$$0 from "process";
import require$$0$1 from "buffer";
var dist = {};
var composer = {};
var directives = {};
var identity$1 = {};
var hasRequiredIdentity;
function requireIdentity() {
  if (hasRequiredIdentity) return identity$1;
  hasRequiredIdentity = 1;
  const ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
  const DOC = /* @__PURE__ */ Symbol.for("yaml.document");
  const MAP = /* @__PURE__ */ Symbol.for("yaml.map");
  const PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
  const SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
  const SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
  const NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
  const isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  const isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  const isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  const isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  const isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  const isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
  identity$1.ALIAS = ALIAS;
  identity$1.DOC = DOC;
  identity$1.MAP = MAP;
  identity$1.NODE_TYPE = NODE_TYPE;
  identity$1.PAIR = PAIR;
  identity$1.SCALAR = SCALAR;
  identity$1.SEQ = SEQ;
  identity$1.hasAnchor = hasAnchor;
  identity$1.isAlias = isAlias;
  identity$1.isCollection = isCollection;
  identity$1.isDocument = isDocument;
  identity$1.isMap = isMap;
  identity$1.isNode = isNode;
  identity$1.isPair = isPair;
  identity$1.isScalar = isScalar;
  identity$1.isSeq = isSeq;
  return identity$1;
}
var visit = {};
var hasRequiredVisit;
function requireVisit() {
  if (hasRequiredVisit) return visit;
  hasRequiredVisit = 1;
  var identity2 = requireIdentity();
  const BREAK = /* @__PURE__ */ Symbol("break visit");
  const SKIP = /* @__PURE__ */ Symbol("skip children");
  const REMOVE = /* @__PURE__ */ Symbol("remove node");
  function visit$1(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity2.isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit$1.BREAK = BREAK;
  visit$1.SKIP = SKIP;
  visit$1.REMOVE = REMOVE;
  function visit_(key, node, visitor, path2) {
    const ctrl = callVisitor(key, node, visitor, path2);
    if (identity2.isNode(ctrl) || identity2.isPair(ctrl)) {
      replaceNode(key, path2, ctrl);
      return visit_(key, ctrl, visitor, path2);
    }
    if (typeof ctrl !== "symbol") {
      if (identity2.isCollection(node)) {
        path2 = Object.freeze(path2.concat(node));
        for (let i = 0; i < node.items.length; ++i) {
          const ci = visit_(i, node.items[i], visitor, path2);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity2.isPair(node)) {
        path2 = Object.freeze(path2.concat(node));
        const ck = visit_("key", node.key, visitor, path2);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path2);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity2.isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path2) {
    const ctrl = await callVisitor(key, node, visitor, path2);
    if (identity2.isNode(ctrl) || identity2.isPair(ctrl)) {
      replaceNode(key, path2, ctrl);
      return visitAsync_(key, ctrl, visitor, path2);
    }
    if (typeof ctrl !== "symbol") {
      if (identity2.isCollection(node)) {
        path2 = Object.freeze(path2.concat(node));
        for (let i = 0; i < node.items.length; ++i) {
          const ci = await visitAsync_(i, node.items[i], visitor, path2);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity2.isPair(node)) {
        path2 = Object.freeze(path2.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path2);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path2);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path2) {
    if (typeof visitor === "function")
      return visitor(key, node, path2);
    if (identity2.isMap(node))
      return visitor.Map?.(key, node, path2);
    if (identity2.isSeq(node))
      return visitor.Seq?.(key, node, path2);
    if (identity2.isPair(node))
      return visitor.Pair?.(key, node, path2);
    if (identity2.isScalar(node))
      return visitor.Scalar?.(key, node, path2);
    if (identity2.isAlias(node))
      return visitor.Alias?.(key, node, path2);
    return void 0;
  }
  function replaceNode(key, path2, node) {
    const parent = path2[path2.length - 1];
    if (identity2.isCollection(parent)) {
      parent.items[key] = node;
    } else if (identity2.isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (identity2.isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = identity2.isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }
  visit.visit = visit$1;
  visit.visitAsync = visitAsync;
  return visit;
}
var hasRequiredDirectives;
function requireDirectives() {
  if (hasRequiredDirectives) return directives;
  hasRequiredDirectives = 1;
  var identity2 = requireIdentity();
  var visit2 = requireVisit();
  const escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
  class Directives {
    constructor(yaml, tags2) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, Directives.defaultTags, tags2);
    }
    clone() {
      const copy = new Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
      const res = new Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, Directives.defaultTags);
          break;
      }
      return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid2 = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid2);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && identity2.isNode(doc.contents)) {
        const tags2 = {};
        visit2.visit(doc.contents, (_key, node) => {
          if (identity2.isNode(node) && node.tag)
            tags2[node.tag] = true;
        });
        tagNames = Object.keys(tags2);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join("\n");
    }
  }
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
  directives.Directives = Directives;
  return directives;
}
var Document = {};
var Alias = {};
var anchors = {};
var hasRequiredAnchors;
function requireAnchors() {
  if (hasRequiredAnchors) return anchors;
  hasRequiredAnchors = 1;
  var identity2 = requireIdentity();
  var visit2 = requireVisit();
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors2 = /* @__PURE__ */ new Set();
    visit2.visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors2.add(node.anchor);
      }
    });
    return anchors2;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i = 1; true; ++i) {
      const name = `${prefix}${i}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = /* @__PURE__ */ new Map();
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        prevAnchors ?? (prevAnchors = anchorNames(doc));
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      /**
       * With circular references, the source node is only resolved after all
       * of its child nodes are. This is why anchors are set only after all of
       * the nodes have been created.
       */
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (identity2.isScalar(ref.node) || identity2.isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }
  anchors.anchorIsValid = anchorIsValid;
  anchors.anchorNames = anchorNames;
  anchors.createNodeAnchors = createNodeAnchors;
  anchors.findNewAnchor = findNewAnchor;
  return anchors;
}
var Node = {};
var applyReviver = {};
var hasRequiredApplyReviver;
function requireApplyReviver() {
  if (hasRequiredApplyReviver) return applyReviver;
  hasRequiredApplyReviver = 1;
  function applyReviver$1(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0, len = val.length; i < len; ++i) {
          const v0 = val[i];
          const v1 = applyReviver$1(reviver, val, String(i), v0);
          if (v1 === void 0)
            delete val[i];
          else if (v1 !== v0)
            val[i] = v1;
        }
      } else if (val instanceof Map) {
        for (const k2 of Array.from(val.keys())) {
          const v0 = val.get(k2);
          const v1 = applyReviver$1(reviver, val, k2, v0);
          if (v1 === void 0)
            val.delete(k2);
          else if (v1 !== v0)
            val.set(k2, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver$1(reviver, val, v0, v0);
          if (v1 === void 0)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k2, v0] of Object.entries(val)) {
          const v1 = applyReviver$1(reviver, val, k2, v0);
          if (v1 === void 0)
            delete val[k2];
          else if (v1 !== v0)
            val[k2] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }
  applyReviver.applyReviver = applyReviver$1;
  return applyReviver;
}
var toJS = {};
var hasRequiredToJS;
function requireToJS() {
  if (hasRequiredToJS) return toJS;
  hasRequiredToJS = 1;
  var identity2 = requireIdentity();
  function toJS$1(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v, i) => toJS$1(v, String(i), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !identity2.hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: void 0 };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }
  toJS.toJS = toJS$1;
  return toJS;
}
var hasRequiredNode;
function requireNode() {
  if (hasRequiredNode) return Node;
  hasRequiredNode = 1;
  var applyReviver2 = requireApplyReviver();
  var identity2 = requireIdentity();
  var toJS2 = requireToJS();
  class NodeBase {
    constructor(type) {
      Object.defineProperty(this, identity2.NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!identity2.isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS2.toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver2.applyReviver(reviver, { "": res }, "", res) : res;
    }
  }
  Node.NodeBase = NodeBase;
  return Node;
}
var hasRequiredAlias;
function requireAlias() {
  if (hasRequiredAlias) return Alias;
  hasRequiredAlias = 1;
  var anchors2 = requireAnchors();
  var visit2 = requireVisit();
  var identity2 = requireIdentity();
  var Node2 = requireNode();
  var toJS2 = requireToJS();
  let Alias$1 = class Alias extends Node2.NodeBase {
    constructor(source) {
      super(identity2.ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc, ctx) {
      if (ctx?.maxAliasCount === 0)
        throw new ReferenceError("Alias resolution is disabled");
      let nodes;
      if (ctx?.aliasResolveCache) {
        nodes = ctx.aliasResolveCache;
      } else {
        nodes = [];
        visit2.visit(doc, {
          Node: (_key, node) => {
            if (identity2.isAlias(node) || identity2.hasAnchor(node))
              nodes.push(node);
          }
        });
        if (ctx)
          ctx.aliasResolveCache = nodes;
      }
      let found = void 0;
      for (const node of nodes) {
        if (node === this)
          break;
        if (node.anchor === this.source)
          found = node;
      }
      if (found && ctx) {
        const { anchors: anchors3, doc: doc2, maxAliasCount } = ctx;
        let data = anchors3.get(found);
        if (!data) {
          toJS2.toJS(found, null, ctx);
          data = anchors3.get(found);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc2, found, anchors3);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
      }
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const source = this.resolve(ctx.doc, ctx);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      return ctx.anchors.get(source).res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchors2.anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  };
  function getAliasCount(doc, node, anchors3) {
    if (identity2.isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors3 && source && anchors3.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (identity2.isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c2 = getAliasCount(doc, item, anchors3);
        if (c2 > count)
          count = c2;
      }
      return count;
    } else if (identity2.isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors3);
      const vc = getAliasCount(doc, node.value, anchors3);
      return Math.max(kc, vc);
    }
    return 1;
  }
  Alias.Alias = Alias$1;
  return Alias;
}
var Collection = {};
var createNode = {};
var Scalar = {};
var hasRequiredScalar;
function requireScalar() {
  if (hasRequiredScalar) return Scalar;
  hasRequiredScalar = 1;
  var identity2 = requireIdentity();
  var Node2 = requireNode();
  var toJS2 = requireToJS();
  const isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
  let Scalar$1 = class Scalar extends Node2.NodeBase {
    constructor(value) {
      super(identity2.SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS2.toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  };
  Scalar$1.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar$1.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar$1.PLAIN = "PLAIN";
  Scalar$1.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar$1.QUOTE_SINGLE = "QUOTE_SINGLE";
  Scalar.Scalar = Scalar$1;
  Scalar.isScalarValue = isScalarValue;
  return Scalar;
}
var hasRequiredCreateNode;
function requireCreateNode() {
  if (hasRequiredCreateNode) return createNode;
  hasRequiredCreateNode = 1;
  var Alias2 = requireAlias();
  var identity2 = requireIdentity();
  var Scalar2 = requireScalar();
  const defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags2) {
    if (tagName) {
      const match = tags2.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags2.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode$1(value, tagName, ctx) {
    if (identity2.isDocument(value))
      value = value.contents;
    if (identity2.isNode(value))
      return value;
    if (identity2.isPair(value)) {
      const map2 = ctx.schema[identity2.MAP].createNode?.(ctx.schema, null, ctx);
      map2.items.push(value);
      return map2;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema2, sourceObjects } = ctx;
    let ref = void 0;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        ref.anchor ?? (ref.anchor = onAnchor(value));
        return new Alias2.Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema2.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar2.Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema2[identity2.MAP] : Symbol.iterator in Object(value) ? schema2[identity2.SEQ] : schema2[identity2.MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar2.Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }
  createNode.createNode = createNode$1;
  return createNode;
}
var hasRequiredCollection;
function requireCollection() {
  if (hasRequiredCollection) return Collection;
  hasRequiredCollection = 1;
  var createNode2 = requireCreateNode();
  var identity2 = requireIdentity();
  var Node2 = requireNode();
  function collectionFromPath(schema2, path2, value) {
    let v = value;
    for (let i = path2.length - 1; i >= 0; --i) {
      const k2 = path2[i];
      if (typeof k2 === "number" && Number.isInteger(k2) && k2 >= 0) {
        const a = [];
        a[k2] = v;
        v = a;
      } else {
        v = /* @__PURE__ */ new Map([[k2, v]]);
      }
    }
    return createNode2.createNode(v, void 0, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema: schema2,
      sourceObjects: /* @__PURE__ */ new Map()
    });
  }
  const isEmptyPath = (path2) => path2 == null || typeof path2 === "object" && !!path2[Symbol.iterator]().next().done;
  let Collection$1 = class Collection extends Node2.NodeBase {
    constructor(type, schema2) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema2,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema2) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema2)
        copy.schema = schema2;
      copy.items = copy.items.map((it) => identity2.isNode(it) || identity2.isPair(it) ? it.clone(schema2) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path2, value) {
      if (isEmptyPath(path2))
        this.add(value);
      else {
        const [key, ...rest] = path2;
        const node = this.get(key, true);
        if (identity2.isCollection(node))
          node.addIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path2) {
      const [key, ...rest] = path2;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (identity2.isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path2, keepScalar) {
      const [key, ...rest] = path2;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && identity2.isScalar(node) ? node.value : node;
      else
        return identity2.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!identity2.isPair(node))
          return false;
        const n = node.value;
        return n == null || allowScalar && identity2.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path2) {
      const [key, ...rest] = path2;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return identity2.isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path2, value) {
      const [key, ...rest] = path2;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (identity2.isCollection(node))
          node.setIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  };
  Collection.Collection = Collection$1;
  Collection.collectionFromPath = collectionFromPath;
  Collection.isEmptyPath = isEmptyPath;
  return Collection;
}
var Pair = {};
var stringifyPair = {};
var stringify = {};
var stringifyComment = {};
var hasRequiredStringifyComment;
function requireStringifyComment() {
  if (hasRequiredStringifyComment) return stringifyComment;
  hasRequiredStringifyComment = 1;
  const stringifyComment$1 = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  const lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
  stringifyComment.indentComment = indentComment;
  stringifyComment.lineComment = lineComment;
  stringifyComment.stringifyComment = stringifyComment$1;
  return stringifyComment;
}
var stringifyString = {};
var foldFlowLines = {};
var hasRequiredFoldFlowLines;
function requireFoldFlowLines() {
  if (hasRequiredFoldFlowLines) return foldFlowLines;
  hasRequiredFoldFlowLines = 1;
  const FOLD_FLOW = "flow";
  const FOLD_BLOCK = "block";
  const FOLD_QUOTED = "quoted";
  function foldFlowLines$1(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
      return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = void 0;
    let prev = void 0;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text, i, indent.length);
      if (i !== -1)
        end = i + endStep;
    }
    for (let ch; ch = text[i += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i;
        switch (text[i + 1]) {
          case "x":
            i += 3;
            break;
          case "u":
            i += 5;
            break;
          case "U":
            i += 9;
            break;
          default:
            i += 1;
        }
        escEnd = i;
      }
      if (ch === "\n") {
        if (mode === FOLD_BLOCK)
          i = consumeMoreIndentedLines(text, i, indent.length);
        end = i + indent.length + endStep;
        split = void 0;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
          const next = text[i + 1];
          if (next && next !== " " && next !== "\n" && next !== "	")
            split = i;
        }
        if (i >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = void 0;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "	") {
              prev = ch;
              ch = text[i += 1];
              overflow = true;
            }
            const j = i > escEnd + 1 ? i - 2 : escStart - 1;
            if (escapedFolds[j])
              return text;
            folds.push(j);
            escapedFolds[j] = true;
            end = j + endStep;
            split = void 0;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text;
    if (onFold)
      onFold();
    let res = text.slice(0, folds[0]);
    for (let i2 = 0; i2 < folds.length; ++i2) {
      const fold = folds[i2];
      const end2 = folds[i2 + 1] || text.length;
      if (fold === 0)
        res = `
${indent}${text.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text[fold]}\\`;
        res += `
${indent}${text.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text[start];
    while (ch === " " || ch === "	") {
      if (i < start + indent) {
        ch = text[++i];
      } else {
        do {
          ch = text[++i];
        } while (ch && ch !== "\n");
        end = i;
        start = i + 1;
        ch = text[start];
      }
    }
    return end;
  }
  foldFlowLines.FOLD_BLOCK = FOLD_BLOCK;
  foldFlowLines.FOLD_FLOW = FOLD_FLOW;
  foldFlowLines.FOLD_QUOTED = FOLD_QUOTED;
  foldFlowLines.foldFlowLines = foldFlowLines$1;
  return foldFlowLines;
}
var hasRequiredStringifyString;
function requireStringifyString() {
  if (hasRequiredStringifyString) return stringifyString;
  hasRequiredStringifyString = 1;
  var Scalar2 = requireScalar();
  var foldFlowLines2 = requireFoldFlowLines();
  const getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i = 0, start = 0; i < strLen; ++i) {
      if (str[i] === "\n") {
        if (i - start > limit)
          return true;
        start = i + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
      if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
        str += json.slice(start, i) + "\\ ";
        i += 1;
        start = i;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i + 1]) {
          case "u":
            {
              str += json.slice(start, i);
              const code = json.substr(i + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i, 6);
              }
              i += 5;
              start = i + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
              i += 1;
            } else {
              str += json.slice(start, i) + "\n\n";
              while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                str += "\n";
                i += 2;
              }
              str += indent;
              if (json[i + 2] === " ")
                str += "\\";
              i += 1;
              start = i + 1;
            }
            break;
          default:
            i += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines2.foldFlowLines(str, indent, foldFlowLines2.FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines2.foldFlowLines(res, indent, foldFlowLines2.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  let blockEndNewlines;
  try {
    blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar2.Scalar.BLOCK_FOLDED ? false : type === Scalar2.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? "|\n" : ">\n";
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== "\n" && ch !== "	" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf("\n");
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === "\n")
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === "\n")
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar2.Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines2.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines2.FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar2.Scalar.PLAIN && value.includes("\n")) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags: tags2 } = ctx.doc.schema;
      if (tags2.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines2.foldFlowLines(str, indent, foldFlowLines2.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString$1(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar2.Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar2.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar2.Scalar.BLOCK_FOLDED:
        case Scalar2.Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar2.Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar2.Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar2.Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }
  stringifyString.stringifyString = stringifyString$1;
  return stringifyString;
}
var hasRequiredStringify;
function requireStringify() {
  if (hasRequiredStringify) return stringify;
  hasRequiredStringify = 1;
  var anchors2 = requireAnchors();
  var identity2 = requireIdentity();
  var stringifyComment2 = requireStringifyComment();
  var stringifyString2 = requireStringifyString();
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment2.stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trailingComma: false,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: /* @__PURE__ */ new Set(),
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags2, item) {
    if (item.tag) {
      const match = tags2.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = void 0;
    let obj;
    if (identity2.isScalar(item)) {
      obj = item.value;
      let match = tags2.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags2.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (identity2.isScalar(node) || identity2.isCollection(node)) && node.anchor;
    if (anchor && anchors2.anchorIsValid(anchor)) {
      anchors$1.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify$1(item, ctx, onComment, onChompKeep) {
    if (identity2.isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (identity2.isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if (ctx.resolvedAliases?.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = void 0;
    const node = identity2.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity2.isScalar(node) ? stringifyString2.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return identity2.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }
  stringify.createStringifyContext = createStringifyContext;
  stringify.stringify = stringify$1;
  return stringify;
}
var hasRequiredStringifyPair;
function requireStringifyPair() {
  if (hasRequiredStringifyPair) return stringifyPair;
  hasRequiredStringifyPair = 1;
  var identity2 = requireIdentity();
  var Scalar2 = requireScalar();
  var stringify2 = requireStringify();
  var stringifyComment2 = requireStringifyComment();
  function stringifyPair$1({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = identity2.isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (identity2.isCollection(key) || !identity2.isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity2.isCollection(key) || (identity2.isScalar(key) ? key.type === Scalar2.Scalar.BLOCK_FOLDED || key.type === Scalar2.Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify2.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += stringifyComment2.lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += stringifyComment2.lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += stringifyComment2.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity2.isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity2.isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity2.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify2.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? "\n" : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${stringifyComment2.indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === "\n" && valueComment)
          ws = "\n\n";
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && identity2.isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf("\n");
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === "\n") {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += stringifyComment2.lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }
  stringifyPair.stringifyPair = stringifyPair$1;
  return stringifyPair;
}
var addPairToJSMap = {};
var log = {};
var hasRequiredLog;
function requireLog() {
  if (hasRequiredLog) return log;
  hasRequiredLog = 1;
  var node_process = require$$0;
  function debug(logLevel, ...messages) {
    if (logLevel === "debug")
      console.log(...messages);
  }
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      if (typeof node_process.emitWarning === "function")
        node_process.emitWarning(warning);
      else
        console.warn(warning);
    }
  }
  log.debug = debug;
  log.warn = warn;
  return log;
}
var merge = {};
var hasRequiredMerge;
function requireMerge() {
  if (hasRequiredMerge) return merge;
  hasRequiredMerge = 1;
  var identity2 = requireIdentity();
  var Scalar2 = requireScalar();
  const MERGE_KEY = "<<";
  const merge$1 = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar2.Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  const isMergeKey = (ctx, key) => (merge$1.identify(key) || identity2.isScalar(key) && (!key.type || key.type === Scalar2.Scalar.PLAIN) && merge$1.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge$1.tag && tag.default);
  function addMergeToJSMap(ctx, map2, value) {
    const source = resolveAliasValue(ctx, value);
    if (identity2.isSeq(source))
      for (const it of source.items)
        mergeValue(ctx, map2, it);
    else if (Array.isArray(source))
      for (const it of source)
        mergeValue(ctx, map2, it);
    else
      mergeValue(ctx, map2, source);
  }
  function mergeValue(ctx, map2, value) {
    const source = resolveAliasValue(ctx, value);
    if (!identity2.isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map2 instanceof Map) {
        if (!map2.has(key))
          map2.set(key, value2);
      } else if (map2 instanceof Set) {
        map2.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
        Object.defineProperty(map2, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map2;
  }
  function resolveAliasValue(ctx, value) {
    return ctx && identity2.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
  }
  merge.addMergeToJSMap = addMergeToJSMap;
  merge.isMergeKey = isMergeKey;
  merge.merge = merge$1;
  return merge;
}
var hasRequiredAddPairToJSMap;
function requireAddPairToJSMap() {
  if (hasRequiredAddPairToJSMap) return addPairToJSMap;
  hasRequiredAddPairToJSMap = 1;
  var log2 = requireLog();
  var merge2 = requireMerge();
  var stringify2 = requireStringify();
  var identity2 = requireIdentity();
  var toJS2 = requireToJS();
  function addPairToJSMap$1(ctx, map2, { key, value }) {
    if (identity2.isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map2, value);
    else if (merge2.isMergeKey(ctx, key))
      merge2.addMergeToJSMap(ctx, map2, value);
    else {
      const jsKey = toJS2.toJS(key, "", ctx);
      if (map2 instanceof Map) {
        map2.set(jsKey, toJS2.toJS(value, jsKey, ctx));
      } else if (map2 instanceof Set) {
        map2.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS2.toJS(value, stringKey, ctx);
        if (stringKey in map2)
          Object.defineProperty(map2, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map2[stringKey] = jsValue;
      }
    }
    return map2;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (identity2.isNode(key) && ctx?.doc) {
      const strCtx = stringify2.createStringifyContext(ctx.doc, {});
      strCtx.anchors = /* @__PURE__ */ new Set();
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        log2.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }
  addPairToJSMap.addPairToJSMap = addPairToJSMap$1;
  return addPairToJSMap;
}
var hasRequiredPair;
function requirePair() {
  if (hasRequiredPair) return Pair;
  hasRequiredPair = 1;
  var createNode2 = requireCreateNode();
  var stringifyPair2 = requireStringifyPair();
  var addPairToJSMap2 = requireAddPairToJSMap();
  var identity2 = requireIdentity();
  function createPair(key, value, ctx) {
    const k2 = createNode2.createNode(key, void 0, ctx);
    const v = createNode2.createNode(value, void 0, ctx);
    return new Pair$1(k2, v);
  }
  let Pair$1 = class Pair2 {
    constructor(key, value = null) {
      Object.defineProperty(this, identity2.NODE_TYPE, { value: identity2.PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema2) {
      let { key, value } = this;
      if (identity2.isNode(key))
        key = key.clone(schema2);
      if (identity2.isNode(value))
        value = value.clone(schema2);
      return new Pair2(key, value);
    }
    toJSON(_, ctx) {
      const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      return addPairToJSMap2.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair2.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  };
  Pair.Pair = Pair$1;
  Pair.createPair = createPair;
  return Pair;
}
var Schema = {};
var map = {};
var YAMLMap = {};
var stringifyCollection = {};
var hasRequiredStringifyCollection;
function requireStringifyCollection() {
  if (hasRequiredStringifyCollection) return stringifyCollection;
  hasRequiredStringifyCollection = 1;
  var identity2 = requireIdentity();
  var stringify2 = requireStringify();
  var stringifyComment2 = requireStringifyComment();
  function stringifyCollection$1(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify3 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify3(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      let comment2 = null;
      if (identity2.isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment2 = item.comment;
      } else if (identity2.isPair(item)) {
        const ik = identity2.isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify2.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += stringifyComment2.lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i];
        str += line ? `
${indent}${line}` : "\n";
      }
    }
    if (comment) {
      str += "\n" + stringifyComment2.indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      let comment = null;
      if (identity2.isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment = item.comment;
      } else if (identity2.isPair(item)) {
        const ik = identity2.isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = identity2.isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify2.stringify(item, itemCtx, () => comment = null);
      reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
      if (i < items.length - 1) {
        str += ",";
      } else if (ctx.options.trailingComma) {
        if (ctx.options.lineWidth > 0) {
          reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
        }
        if (reqNewline) {
          str += ",";
        }
      }
      if (comment)
        str += stringifyComment2.lineComment(str, itemIndent, commentString(comment));
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : "\n";
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = stringifyComment2.indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }
  stringifyCollection.stringifyCollection = stringifyCollection$1;
  return stringifyCollection;
}
var hasRequiredYAMLMap;
function requireYAMLMap() {
  if (hasRequiredYAMLMap) return YAMLMap;
  hasRequiredYAMLMap = 1;
  var stringifyCollection2 = requireStringifyCollection();
  var addPairToJSMap2 = requireAddPairToJSMap();
  var Collection2 = requireCollection();
  var identity2 = requireIdentity();
  var Pair2 = requirePair();
  var Scalar2 = requireScalar();
  function findPair(items, key) {
    const k2 = identity2.isScalar(key) ? key.value : key;
    for (const it of items) {
      if (identity2.isPair(it)) {
        if (it.key === key || it.key === k2)
          return it;
        if (identity2.isScalar(it.key) && it.key.value === k2)
          return it;
      }
    }
    return void 0;
  }
  let YAMLMap$1 = class YAMLMap extends Collection2.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema2) {
      super(identity2.MAP, schema2);
      this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema2, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map2 = new this(schema2);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== void 0 || keepUndefined)
          map2.items.push(Pair2.createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema2.sortMapEntries === "function") {
        map2.items.sort(schema2.sortMapEntries);
      }
      return map2;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair, overwrite) {
      let _pair;
      if (identity2.isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair2.Pair(pair, pair?.value);
      } else
        _pair = new Pair2.Pair(pair.key, pair.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (identity2.isScalar(prev.value) && Scalar2.isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i === -1)
          this.items.push(_pair);
        else
          this.items.splice(i, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && identity2.isScalar(node) ? node.value : node) ?? void 0;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair2.Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
      const map2 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const item of this.items)
        addPairToJSMap2.addPairToJSMap(ctx, map2, item);
      return map2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!identity2.isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection2.stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  };
  YAMLMap.YAMLMap = YAMLMap$1;
  YAMLMap.findPair = findPair;
  return YAMLMap;
}
var hasRequiredMap;
function requireMap() {
  if (hasRequiredMap) return map;
  hasRequiredMap = 1;
  var identity2 = requireIdentity();
  var YAMLMap2 = requireYAMLMap();
  const map$1 = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap2.YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!identity2.isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema2, obj, ctx) => YAMLMap2.YAMLMap.from(schema2, obj, ctx)
  };
  map.map = map$1;
  return map;
}
var seq = {};
var YAMLSeq = {};
var hasRequiredYAMLSeq;
function requireYAMLSeq() {
  if (hasRequiredYAMLSeq) return YAMLSeq;
  hasRequiredYAMLSeq = 1;
  var createNode2 = requireCreateNode();
  var stringifyCollection2 = requireStringifyCollection();
  var Collection2 = requireCollection();
  var identity2 = requireIdentity();
  var Scalar2 = requireScalar();
  var toJS2 = requireToJS();
  let YAMLSeq$1 = class YAMLSeq extends Collection2.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema2) {
      super(identity2.SEQ, schema2);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return void 0;
      const it = this.items[idx];
      return !keepScalar && identity2.isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (identity2.isScalar(prev) && Scalar2.isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq2 = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq2);
      let i = 0;
      for (const item of this.items)
        seq2.push(toJS2.toJS(item, String(i++), ctx));
      return seq2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection2.stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema2, obj, ctx) {
      const { replacer } = ctx;
      const seq2 = new this(schema2);
      if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i++);
            it = replacer.call(obj, key, it);
          }
          seq2.items.push(createNode2.createNode(it, void 0, ctx));
        }
      }
      return seq2;
    }
  };
  function asItemIndex(key) {
    let idx = identity2.isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }
  YAMLSeq.YAMLSeq = YAMLSeq$1;
  return YAMLSeq;
}
var hasRequiredSeq;
function requireSeq() {
  if (hasRequiredSeq) return seq;
  hasRequiredSeq = 1;
  var identity2 = requireIdentity();
  var YAMLSeq2 = requireYAMLSeq();
  const seq$1 = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq2.YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!identity2.isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema2, obj, ctx) => YAMLSeq2.YAMLSeq.from(schema2, obj, ctx)
  };
  seq.seq = seq$1;
  return seq;
}
var string = {};
var hasRequiredString;
function requireString() {
  if (hasRequiredString) return string;
  hasRequiredString = 1;
  var stringifyString2 = requireStringifyString();
  const string$1 = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString2.stringifyString(item, ctx, onComment, onChompKeep);
    }
  };
  string.string = string$1;
  return string;
}
var tags = {};
var _null = {};
var hasRequired_null;
function require_null() {
  if (hasRequired_null) return _null;
  hasRequired_null = 1;
  var Scalar2 = requireScalar();
  const nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar2.Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar2.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };
  _null.nullTag = nullTag;
  return _null;
}
var bool$1 = {};
var hasRequiredBool$1;
function requireBool$1() {
  if (hasRequiredBool$1) return bool$1;
  hasRequiredBool$1 = 1;
  var Scalar2 = requireScalar();
  const boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar2.Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };
  bool$1.boolTag = boolTag;
  return bool$1;
}
var float$1 = {};
var stringifyNumber = {};
var hasRequiredStringifyNumber;
function requireStringifyNumber() {
  if (hasRequiredStringifyNumber) return stringifyNumber;
  hasRequiredStringifyNumber = 1;
  function stringifyNumber$1({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num2 = typeof value === "number" ? value : Number(value);
    if (!isFinite(num2))
      return isNaN(num2) ? ".nan" : num2 < 0 ? "-.inf" : ".inf";
    let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
      let i = n.indexOf(".");
      if (i < 0) {
        i = n.length;
        n += ".";
      }
      let d = minFractionDigits - (n.length - i - 1);
      while (d-- > 0)
        n += "0";
    }
    return n;
  }
  stringifyNumber.stringifyNumber = stringifyNumber$1;
  return stringifyNumber;
}
var hasRequiredFloat$1;
function requireFloat$1() {
  if (hasRequiredFloat$1) return float$1;
  hasRequiredFloat$1 = 1;
  var Scalar2 = requireScalar();
  var stringifyNumber2 = requireStringifyNumber();
  const floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber2.stringifyNumber
  };
  const floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num2 = Number(node.value);
      return isFinite(num2) ? num2.toExponential() : stringifyNumber2.stringifyNumber(node);
    }
  };
  const float2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar2.Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber2.stringifyNumber
  };
  float$1.float = float2;
  float$1.floatExp = floatExp;
  float$1.floatNaN = floatNaN;
  return float$1;
}
var int$1 = {};
var hasRequiredInt$1;
function requireInt$1() {
  if (hasRequiredInt$1) return int$1;
  hasRequiredInt$1 = 1;
  var stringifyNumber2 = requireStringifyNumber();
  const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  const intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber2.stringifyNumber(node);
  }
  const intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  const int2 = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber2.stringifyNumber
  };
  const intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  int$1.int = int2;
  int$1.intHex = intHex;
  int$1.intOct = intOct;
  return int$1;
}
var schema$2 = {};
var hasRequiredSchema$3;
function requireSchema$3() {
  if (hasRequiredSchema$3) return schema$2;
  hasRequiredSchema$3 = 1;
  var map2 = requireMap();
  var _null2 = require_null();
  var seq2 = requireSeq();
  var string2 = requireString();
  var bool2 = requireBool$1();
  var float2 = requireFloat$1();
  var int2 = requireInt$1();
  const schema2 = [
    map2.map,
    seq2.seq,
    string2.string,
    _null2.nullTag,
    bool2.boolTag,
    int2.intOct,
    int2.int,
    int2.intHex,
    float2.floatNaN,
    float2.floatExp,
    float2.float
  ];
  schema$2.schema = schema2;
  return schema$2;
}
var schema$1 = {};
var hasRequiredSchema$2;
function requireSchema$2() {
  if (hasRequiredSchema$2) return schema$1;
  hasRequiredSchema$2 = 1;
  var Scalar2 = requireScalar();
  var map2 = requireMap();
  var seq2 = requireSeq();
  function intIdentify(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  const stringifyJSON = ({ value }) => JSON.stringify(value);
  const jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar2.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  const jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  const schema2 = [map2.map, seq2.seq].concat(jsonScalars, jsonError);
  schema$1.schema = schema2;
  return schema$1;
}
var binary = {};
var hasRequiredBinary;
function requireBinary() {
  if (hasRequiredBinary) return binary;
  hasRequiredBinary = 1;
  var node_buffer = require$$0$1;
  var Scalar2 = requireScalar();
  var stringifyString2 = requireStringifyString();
  const binary$1 = {
    identify: (value) => value instanceof Uint8Array,
    // Buffer inherits from Uint8Array
    default: false,
    tag: "tag:yaml.org,2002:binary",
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
      if (typeof node_buffer.Buffer === "function") {
        return node_buffer.Buffer.from(src, "base64");
      } else if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i = 0; i < str.length; ++i)
          buffer[i] = str.charCodeAt(i);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      if (!value)
        return "";
      const buf = value;
      let str;
      if (typeof node_buffer.Buffer === "function") {
        str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
      } else if (typeof btoa === "function") {
        let s = "";
        for (let i = 0; i < buf.length; ++i)
          s += String.fromCharCode(buf[i]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      type ?? (type = Scalar2.Scalar.BLOCK_LITERAL);
      if (type !== Scalar2.Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n = Math.ceil(str.length / lineWidth);
        const lines = new Array(n);
        for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
          lines[i] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar2.Scalar.BLOCK_LITERAL ? "\n" : " ");
      }
      return stringifyString2.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };
  binary.binary = binary$1;
  return binary;
}
var omap = {};
var pairs = {};
var hasRequiredPairs;
function requirePairs() {
  if (hasRequiredPairs) return pairs;
  hasRequiredPairs = 1;
  var identity2 = requireIdentity();
  var Pair2 = requirePair();
  var Scalar2 = requireScalar();
  var YAMLSeq2 = requireYAMLSeq();
  function resolvePairs(seq2, onError) {
    if (identity2.isSeq(seq2)) {
      for (let i = 0; i < seq2.items.length; ++i) {
        let item = seq2.items[i];
        if (identity2.isPair(item))
          continue;
        else if (identity2.isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair2.Pair(new Scalar2.Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq2.items[i] = identity2.isPair(item) ? item : new Pair2.Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq2;
  }
  function createPairs(schema2, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq2.YAMLSeq(schema2);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(Pair2.createPair(key, value, ctx));
      }
    return pairs2;
  }
  const pairs$1 = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };
  pairs.createPairs = createPairs;
  pairs.pairs = pairs$1;
  pairs.resolvePairs = resolvePairs;
  return pairs;
}
var hasRequiredOmap;
function requireOmap() {
  if (hasRequiredOmap) return omap;
  hasRequiredOmap = 1;
  var identity2 = requireIdentity();
  var toJS2 = requireToJS();
  var YAMLMap2 = requireYAMLMap();
  var YAMLSeq2 = requireYAMLSeq();
  var pairs2 = requirePairs();
  class YAMLOMap extends YAMLSeq2.YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap2.YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap2.YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap2.YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap2.YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap2.YAMLMap.prototype.set.bind(this);
      this.tag = YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map2 = /* @__PURE__ */ new Map();
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const pair of this.items) {
        let key, value;
        if (identity2.isPair(pair)) {
          key = toJS2.toJS(pair.key, "", ctx);
          value = toJS2.toJS(pair.value, key, ctx);
        } else {
          key = toJS2.toJS(pair, "", ctx);
        }
        if (map2.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map2.set(key, value);
      }
      return map2;
    }
    static from(schema2, iterable, ctx) {
      const pairs$1 = pairs2.createPairs(schema2, iterable, ctx);
      const omap2 = new this();
      omap2.items = pairs$1.items;
      return omap2;
    }
  }
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  const omap$1 = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq2, onError) {
      const pairs$1 = pairs2.resolvePairs(seq2, onError);
      const seenKeys = [];
      for (const { key } of pairs$1.items) {
        if (identity2.isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap(), pairs$1);
    },
    createNode: (schema2, iterable, ctx) => YAMLOMap.from(schema2, iterable, ctx)
  };
  omap.YAMLOMap = YAMLOMap;
  omap.omap = omap$1;
  return omap;
}
var schema = {};
var bool = {};
var hasRequiredBool;
function requireBool() {
  if (hasRequiredBool) return bool;
  hasRequiredBool = 1;
  var Scalar2 = requireScalar();
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  const trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar2.Scalar(true),
    stringify: boolStringify
  };
  const falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar2.Scalar(false),
    stringify: boolStringify
  };
  bool.falseTag = falseTag;
  bool.trueTag = trueTag;
  return bool;
}
var float = {};
var hasRequiredFloat;
function requireFloat() {
  if (hasRequiredFloat) return float;
  hasRequiredFloat = 1;
  var Scalar2 = requireScalar();
  var stringifyNumber2 = requireStringifyNumber();
  const floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber2.stringifyNumber
  };
  const floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num2 = Number(node.value);
      return isFinite(num2) ? num2.toExponential() : stringifyNumber2.stringifyNumber(node);
    }
  };
  const float$12 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar2.Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f2 = str.substring(dot + 1).replace(/_/g, "");
        if (f2[f2.length - 1] === "0")
          node.minFractionDigits = f2.length;
      }
      return node;
    },
    stringify: stringifyNumber2.stringifyNumber
  };
  float.float = float$12;
  float.floatExp = floatExp;
  float.floatNaN = floatNaN;
  return float;
}
var int = {};
var hasRequiredInt;
function requireInt() {
  if (hasRequiredInt) return int;
  hasRequiredInt = 1;
  var stringifyNumber2 = requireStringifyNumber();
  const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n2 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n2 : n2;
    }
    const n = parseInt(str, radix);
    return sign === "-" ? -1 * n : n;
  }
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber2.stringifyNumber(node);
  }
  const intBin = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: (node) => intStringify(node, 2, "0b")
  };
  const intOct = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: (node) => intStringify(node, 8, "0")
  };
  const int$12 = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber2.stringifyNumber
  };
  const intHex = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  int.int = int$12;
  int.intBin = intBin;
  int.intHex = intHex;
  int.intOct = intOct;
  return int;
}
var set = {};
var hasRequiredSet;
function requireSet() {
  if (hasRequiredSet) return set;
  hasRequiredSet = 1;
  var identity2 = requireIdentity();
  var Pair2 = requirePair();
  var YAMLMap2 = requireYAMLMap();
  class YAMLSet extends YAMLMap2.YAMLMap {
    constructor(schema2) {
      super(schema2);
      this.tag = YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (identity2.isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair2.Pair(key.key, null);
      else
        pair = new Pair2.Pair(key, null);
      const prev = YAMLMap2.findPair(this.items, pair.key);
      if (!prev)
        this.items.push(pair);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
      const pair = YAMLMap2.findPair(this.items, key);
      return !keepPair && identity2.isPair(pair) ? identity2.isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = YAMLMap2.findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair2.Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema2, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema2);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(Pair2.createPair(value, null, ctx));
        }
      return set2;
    }
  }
  YAMLSet.tag = "tag:yaml.org,2002:set";
  const set$1 = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema2, iterable, ctx) => YAMLSet.from(schema2, iterable, ctx),
    resolve(map2, onError) {
      if (identity2.isMap(map2)) {
        if (map2.hasAllNullValues(true))
          return Object.assign(new YAMLSet(), map2);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map2;
    }
  };
  set.YAMLSet = YAMLSet;
  set.set = set$1;
  return set;
}
var timestamp = {};
var hasRequiredTimestamp;
function requireTimestamp() {
  if (hasRequiredTimestamp) return timestamp;
  hasRequiredTimestamp = 1;
  var stringifyNumber2 = requireStringifyNumber();
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num2 = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p2) => res2 * num2(60) + num2(p2), num2(0));
    return sign === "-" ? num2(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num2 = (n) => n;
    if (typeof value === "bigint")
      num2 = (n) => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber2.stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num2(-1);
    }
    const _60 = num2(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  const intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  const floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  const timestamp$1 = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
    resolve(str) {
      const match = str.match(timestamp$1.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 6e4 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
  };
  timestamp.floatTime = floatTime;
  timestamp.intTime = intTime;
  timestamp.timestamp = timestamp$1;
  return timestamp;
}
var hasRequiredSchema$1;
function requireSchema$1() {
  if (hasRequiredSchema$1) return schema;
  hasRequiredSchema$1 = 1;
  var map2 = requireMap();
  var _null2 = require_null();
  var seq2 = requireSeq();
  var string2 = requireString();
  var binary2 = requireBinary();
  var bool2 = requireBool();
  var float2 = requireFloat();
  var int2 = requireInt();
  var merge2 = requireMerge();
  var omap2 = requireOmap();
  var pairs2 = requirePairs();
  var set2 = requireSet();
  var timestamp2 = requireTimestamp();
  const schema$12 = [
    map2.map,
    seq2.seq,
    string2.string,
    _null2.nullTag,
    bool2.trueTag,
    bool2.falseTag,
    int2.intBin,
    int2.intOct,
    int2.int,
    int2.intHex,
    float2.floatNaN,
    float2.floatExp,
    float2.float,
    binary2.binary,
    merge2.merge,
    omap2.omap,
    pairs2.pairs,
    set2.set,
    timestamp2.intTime,
    timestamp2.floatTime,
    timestamp2.timestamp
  ];
  schema.schema = schema$12;
  return schema;
}
var hasRequiredTags;
function requireTags() {
  if (hasRequiredTags) return tags;
  hasRequiredTags = 1;
  var map2 = requireMap();
  var _null2 = require_null();
  var seq2 = requireSeq();
  var string2 = requireString();
  var bool2 = requireBool$1();
  var float2 = requireFloat$1();
  var int2 = requireInt$1();
  var schema2 = requireSchema$3();
  var schema$12 = requireSchema$2();
  var binary2 = requireBinary();
  var merge2 = requireMerge();
  var omap2 = requireOmap();
  var pairs2 = requirePairs();
  var schema$22 = requireSchema$1();
  var set2 = requireSet();
  var timestamp2 = requireTimestamp();
  const schemas = /* @__PURE__ */ new Map([
    ["core", schema2.schema],
    ["failsafe", [map2.map, seq2.seq, string2.string]],
    ["json", schema$12.schema],
    ["yaml11", schema$22.schema],
    ["yaml-1.1", schema$22.schema]
  ]);
  const tagsByName = {
    binary: binary2.binary,
    bool: bool2.boolTag,
    float: float2.float,
    floatExp: float2.floatExp,
    floatNaN: float2.floatNaN,
    floatTime: timestamp2.floatTime,
    int: int2.int,
    intHex: int2.intHex,
    intOct: int2.intOct,
    intTime: timestamp2.intTime,
    map: map2.map,
    merge: merge2.merge,
    null: _null2.nullTag,
    omap: omap2.omap,
    pairs: pairs2.pairs,
    seq: seq2.seq,
    set: set2.set,
    timestamp: timestamp2.timestamp
  };
  const coreKnownTags = {
    "tag:yaml.org,2002:binary": binary2.binary,
    "tag:yaml.org,2002:merge": merge2.merge,
    "tag:yaml.org,2002:omap": omap2.omap,
    "tag:yaml.org,2002:pairs": pairs2.pairs,
    "tag:yaml.org,2002:set": set2.set,
    "tag:yaml.org,2002:timestamp": timestamp2.timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge2.merge) ? schemaTags.concat(merge2.merge) : schemaTags.slice();
    }
    let tags2 = schemaTags;
    if (!tags2) {
      if (Array.isArray(customTags))
        tags2 = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags2 = tags2.concat(tag);
    } else if (typeof customTags === "function") {
      tags2 = customTags(tags2.slice());
    }
    if (addMergeTag)
      tags2 = tags2.concat(merge2.merge);
    return tags2.reduce((tags3, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags3.includes(tagObj))
        tags3.push(tagObj);
      return tags3;
    }, []);
  }
  tags.coreKnownTags = coreKnownTags;
  tags.getTags = getTags;
  return tags;
}
var hasRequiredSchema;
function requireSchema() {
  if (hasRequiredSchema) return Schema;
  hasRequiredSchema = 1;
  var identity2 = requireIdentity();
  var map2 = requireMap();
  var seq2 = requireSeq();
  var string2 = requireString();
  var tags2 = requireTags();
  const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  let Schema$1 = class Schema2 {
    constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema2, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? tags2.getTags(compat, "compat") : compat ? tags2.getTags(null, compat) : null;
      this.name = typeof schema2 === "string" && schema2 || "core";
      this.knownTags = resolveKnownTags ? tags2.coreKnownTags : {};
      this.tags = tags2.getTags(customTags, this.name, merge2);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, identity2.MAP, { value: map2.map });
      Object.defineProperty(this, identity2.SCALAR, { value: string2.string });
      Object.defineProperty(this, identity2.SEQ, { value: seq2.seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(Schema2.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  };
  Schema.Schema = Schema$1;
  return Schema;
}
var stringifyDocument = {};
var hasRequiredStringifyDocument;
function requireStringifyDocument() {
  if (hasRequiredStringifyDocument) return stringifyDocument;
  hasRequiredStringifyDocument = 1;
  var identity2 = requireIdentity();
  var stringify2 = requireStringify();
  var stringifyComment2 = requireStringifyComment();
  function stringifyDocument$1(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = stringify2.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(stringifyComment2.indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (identity2.isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(stringifyComment2.indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
      let body = stringify2.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += stringifyComment2.lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify2.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes("\n")) {
          lines.push("...");
          lines.push(stringifyComment2.indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(stringifyComment2.indentComment(commentString(dc), ""));
      }
    }
    return lines.join("\n") + "\n";
  }
  stringifyDocument.stringifyDocument = stringifyDocument$1;
  return stringifyDocument;
}
var hasRequiredDocument;
function requireDocument() {
  if (hasRequiredDocument) return Document;
  hasRequiredDocument = 1;
  var Alias2 = requireAlias();
  var Collection2 = requireCollection();
  var identity2 = requireIdentity();
  var Pair2 = requirePair();
  var toJS2 = requireToJS();
  var Schema2 = requireSchema();
  var stringifyDocument2 = requireStringifyDocument();
  var anchors2 = requireAnchors();
  var applyReviver2 = requireApplyReviver();
  var createNode2 = requireCreateNode();
  var directives2 = requireDirectives();
  let Document$1 = class Document2 {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, identity2.NODE_TYPE, { value: identity2.DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new directives2.Directives({ version });
      this.setSchema(version, options);
      this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
      const copy = Object.create(Document2.prototype, {
        [identity2.NODE_TYPE]: { value: identity2.DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = identity2.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** Adds a value to the document. */
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path2, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path2, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchors2.anchorNames(this);
        node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        !name || prev.has(name) ? anchors2.findNewAnchor(name || "a", prev) : name;
      }
      return new Alias2.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = void 0;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = anchors2.createNodeAnchors(
        this,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || "a"
      );
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode2.createNode(value, tag, ctx);
      if (flow && identity2.isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
      const k2 = this.createNode(key, null, options);
      const v = this.createNode(value, null, options);
      return new Pair2.Pair(k2, v);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path2) {
      if (Collection2.isEmptyPath(path2)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path2) : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
      return identity2.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path2, keepScalar) {
      if (Collection2.isEmptyPath(path2))
        return !keepScalar && identity2.isScalar(this.contents) ? this.contents.value : this.contents;
      return identity2.isCollection(this.contents) ? this.contents.getIn(path2, keepScalar) : void 0;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
      return identity2.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path2) {
      if (Collection2.isEmptyPath(path2))
        return this.contents !== void 0;
      return identity2.isCollection(this.contents) ? this.contents.hasIn(path2) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
      if (this.contents == null) {
        this.contents = Collection2.collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path2, value) {
      if (Collection2.isEmptyPath(path2)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = Collection2.collectionFromPath(this.schema, Array.from(path2), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path2, value);
      }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new directives2.Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new directives2.Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema2.Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS2.toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver2.applyReviver(reviver, { "": res }, "", res) : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument2.stringifyDocument(this, options);
    }
  };
  function assertCollection(contents) {
    if (identity2.isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }
  Document.Document = Document$1;
  return Document;
}
var errors = {};
var hasRequiredErrors;
function requireErrors() {
  if (hasRequiredErrors) return errors;
  hasRequiredErrors = 1;
  class YAMLError extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  }
  class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  }
  class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  }
  const prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "…" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "…";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + "…\n";
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end?.line === line && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer}
`;
    }
  };
  errors.YAMLError = YAMLError;
  errors.YAMLParseError = YAMLParseError;
  errors.YAMLWarning = YAMLWarning;
  errors.prettifyError = prettifyError;
  return errors;
}
var composeDoc = {};
var composeNode = {};
var composeCollection = {};
var resolveBlockMap = {};
var resolveProps = {};
var hasRequiredResolveProps;
function requireResolveProps() {
  if (hasRequiredResolveProps) return resolveProps;
  hasRequiredResolveProps = 1;
  function resolveProps$1(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else if (!found || indicator !== "seq-item-ind")
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        // else fallthrough
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }
  resolveProps.resolveProps = resolveProps$1;
  return resolveProps;
}
var utilContainsNewline = {};
var hasRequiredUtilContainsNewline;
function requireUtilContainsNewline() {
  if (hasRequiredUtilContainsNewline) return utilContainsNewline;
  hasRequiredUtilContainsNewline = 1;
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes("\n"))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }
  utilContainsNewline.containsNewline = containsNewline;
  return utilContainsNewline;
}
var utilFlowIndentCheck = {};
var hasRequiredUtilFlowIndentCheck;
function requireUtilFlowIndentCheck() {
  if (hasRequiredUtilFlowIndentCheck) return utilFlowIndentCheck;
  hasRequiredUtilFlowIndentCheck = 1;
  var utilContainsNewline2 = requireUtilContainsNewline();
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline2.containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }
  utilFlowIndentCheck.flowIndentCheck = flowIndentCheck;
  return utilFlowIndentCheck;
}
var utilMapIncludes = {};
var hasRequiredUtilMapIncludes;
function requireUtilMapIncludes() {
  if (hasRequiredUtilMapIncludes) return utilMapIncludes;
  hasRequiredUtilMapIncludes = 1;
  var identity2 = requireIdentity();
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity2.isScalar(a) && identity2.isScalar(b) && a.value === b.value;
    return items.some((pair) => isEqual(pair.key, search));
  }
  utilMapIncludes.mapIncludes = mapIncludes;
  return utilMapIncludes;
}
var hasRequiredResolveBlockMap;
function requireResolveBlockMap() {
  if (hasRequiredResolveBlockMap) return resolveBlockMap;
  hasRequiredResolveBlockMap = 1;
  var Pair2 = requirePair();
  var YAMLMap2 = requireYAMLMap();
  var resolveProps2 = requireResolveProps();
  var utilContainsNewline2 = requireUtilContainsNewline();
  var utilFlowIndentCheck2 = requireUtilFlowIndentCheck();
  var utilMapIncludes2 = requireUtilMapIncludes();
  const startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap$1({ composeNode: composeNode2, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap2.YAMLMap;
    const map2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps2.resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map2.comment)
              map2.comment += "\n" + keyProps.comment;
            else
              map2.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || utilContainsNewline2.containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck2.flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (utilMapIncludes2.mapIncludes(ctx, map2.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps2.resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck2.flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair2.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair2.Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map2.range = [bm.offset, offset, commentEnd ?? offset];
    return map2;
  }
  resolveBlockMap.resolveBlockMap = resolveBlockMap$1;
  return resolveBlockMap;
}
var resolveBlockSeq = {};
var hasRequiredResolveBlockSeq;
function requireResolveBlockSeq() {
  if (hasRequiredResolveBlockSeq) return resolveBlockSeq;
  hasRequiredResolveBlockSeq = 1;
  var YAMLSeq2 = requireYAMLSeq();
  var resolveProps2 = requireResolveProps();
  var utilFlowIndentCheck2 = requireUtilFlowIndentCheck();
  function resolveBlockSeq$1({ composeNode: composeNode2, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq2.YAMLSeq;
    const seq2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps2.resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value?.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq2.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck2.flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq2.items.push(node);
    }
    seq2.range = [bs.offset, offset, commentEnd ?? offset];
    return seq2;
  }
  resolveBlockSeq.resolveBlockSeq = resolveBlockSeq$1;
  return resolveBlockSeq;
}
var resolveFlowCollection = {};
var resolveEnd = {};
var hasRequiredResolveEnd;
function requireResolveEnd() {
  if (hasRequiredResolveEnd) return resolveEnd;
  hasRequiredResolveEnd = 1;
  function resolveEnd$1(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }
  resolveEnd.resolveEnd = resolveEnd$1;
  return resolveEnd;
}
var hasRequiredResolveFlowCollection;
function requireResolveFlowCollection() {
  if (hasRequiredResolveFlowCollection) return resolveFlowCollection;
  hasRequiredResolveFlowCollection = 1;
  var identity2 = requireIdentity();
  var Pair2 = requirePair();
  var YAMLMap2 = requireYAMLMap();
  var YAMLSeq2 = requireYAMLSeq();
  var resolveEnd2 = requireResolveEnd();
  var resolveProps2 = requireResolveProps();
  var utilContainsNewline2 = requireUtilContainsNewline();
  var utilMapIncludes2 = requireUtilMapIncludes();
  const blockMsg = "Block collections are not allowed within flow collections";
  const isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection$1({ composeNode: composeNode2, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === "{";
    const fcName = isMap ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap2.YAMLMap : YAMLSeq2.YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0; i < fc.items.length; ++i) {
      const collItem = fc.items[i];
      const { start, key, sep, value } = collItem;
      const props = resolveProps2.resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += "\n" + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap && ctx.options.strict && utilContainsNewline2.containsNewline(key))
          onError(
            key,
            // checked by containsNewline()
            "MULTILINE_IMPLICIT_KEY",
            "Implicit keys of flow sequence pairs need to be on a single line"
          );
      }
      if (i === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop: for (const st of start) {
            switch (st.type) {
              case "comma":
              case "space":
                break;
              case "comment":
                prevItemComment = st.source.substring(1);
                break loop;
              default:
                break loop;
            }
          }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (identity2.isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += "\n" + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap && !sep && !props.found) {
        const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps2.resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source?.[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair2.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap) {
          const map2 = coll;
          if (utilMapIncludes2.mapIncludes(ctx, map2.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map2.items.push(pair);
        } else {
          const map2 = new YAMLMap2.YAMLMap(ctx.schema);
          map2.flow = true;
          map2.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map2.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map2);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end = resolveEnd2.resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += "\n" + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }
  resolveFlowCollection.resolveFlowCollection = resolveFlowCollection$1;
  return resolveFlowCollection;
}
var hasRequiredComposeCollection;
function requireComposeCollection() {
  if (hasRequiredComposeCollection) return composeCollection;
  hasRequiredComposeCollection = 1;
  var identity2 = requireIdentity();
  var Scalar2 = requireScalar();
  var YAMLMap2 = requireYAMLMap();
  var YAMLSeq2 = requireYAMLSeq();
  var resolveBlockMap2 = requireResolveBlockMap();
  var resolveBlockSeq2 = requireResolveBlockSeq();
  var resolveFlowCollection2 = requireResolveFlowCollection();
  function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap2.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq2.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection2.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection$1(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap2.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq2.YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt?.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = identity2.isNode(res) ? res : new Scalar2.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }
  composeCollection.composeCollection = composeCollection$1;
  return composeCollection;
}
var composeScalar = {};
var resolveBlockScalar = {};
var hasRequiredResolveBlockScalar;
function requireResolveBlockScalar() {
  if (hasRequiredResolveBlockScalar) return resolveBlockScalar;
  hasRequiredResolveBlockScalar = 1;
  var Scalar2 = requireScalar();
  function resolveBlockScalar$1(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar2.Scalar.BLOCK_FOLDED : Scalar2.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i = lines.length - 1; i >= 0; --i) {
      const content = lines[i][1];
      if (content === "" || content === "\r")
        chompStart = i;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar.source)
        end2 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0; i < chompStart; ++i) {
      const [indent, content] = lines[i];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i = lines.length - 1; i >= chompStart; --i) {
      if (lines[i][0].length > trimIndent)
        chompStart = i + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i = 0; i < contentStart; ++i)
      value += lines[i][0].slice(trimIndent) + "\n";
    for (let i = contentStart; i < chompStart; ++i) {
      let [indent, content] = lines[i];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar2.Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
      } else if (indent.length > trimIndent || content[0] === "	") {
        if (sep === " ")
          sep = "\n";
        else if (!prevMoreIndented && sep === "\n")
          sep = "\n\n";
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === "\n")
          value += "\n";
        else
          sep = "\n";
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i = chompStart; i < lines.length; ++i)
          value += "\n" + lines[i][0].slice(trimIndent);
        if (value[value.length - 1] !== "\n")
          value += "\n";
        break;
      default:
        value += "\n";
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i = 1; i < source.length; ++i) {
      const ch = source[i];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n = Number(ch);
        if (!indent && n)
          indent = n;
        else if (error === -1)
          error = offset + i;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i = 1; i < props.length; ++i) {
      const token = props[i];
      switch (token.type) {
        case "space":
          hasSpace = true;
        // fallthrough
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        /* istanbul ignore next should not happen */
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
    const lines = [line0];
    for (let i = 1; i < split.length; i += 2)
      lines.push([split[i], split[i + 1]]);
    return lines;
  }
  resolveBlockScalar.resolveBlockScalar = resolveBlockScalar$1;
  return resolveBlockScalar;
}
var resolveFlowScalar = {};
var hasRequiredResolveFlowScalar;
function requireResolveFlowScalar() {
  if (hasRequiredResolveFlowScalar) return resolveFlowScalar;
  hasRequiredResolveFlowScalar = 1;
  var Scalar2 = requireScalar();
  var resolveEnd2 = requireResolveEnd();
  function resolveFlowScalar$1(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel2, code, msg) => onError(offset + rel2, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar2.Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar2.Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar2.Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      /* istanbul ignore next should not happen */
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd2.resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      /* istanbul ignore next should not happen */
      case "	":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return unfoldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function unfoldLines(source) {
    const line = /(.*?)\r?\n/sy;
    let match = line.exec(source);
    if (!match)
      return source;
    let trimEnd, trimBoth;
    try {
      trimEnd = new RegExp("(?<![ 	])[ 	]+$");
      trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
    } catch {
      trimEnd = /[ \t]+$/;
      trimBoth = /^[ \t]+|[ \t]+$/g;
    }
    let res = match[1].replace(trimEnd, "");
    let sep = " ";
    let pos = line.lastIndex;
    while (match = line.exec(source)) {
      const lm = match[1].replace(trimBoth, "");
      if (lm === "") {
        if (sep === "\n")
          res += sep;
        else
          sep = "\n";
      } else {
        res += sep + lm;
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i = 1; i < source.length - 1; ++i) {
      const ch = source[i];
      if (ch === "\r" && source[i + 1] === "\n")
        continue;
      if (ch === "\n") {
        const { fold, offset } = foldNewline(source, i);
        res += fold;
        i = offset;
      } else if (ch === "\\") {
        let next = source[++i];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === "\n") {
          next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
        } else if (next === "\r" && source[i + 1] === "\n") {
          next = source[++i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = next === "x" ? 2 : next === "u" ? 4 : 8;
          res += parseCharCode(source, i + 1, length, onError);
          i += length;
        } else {
          const raw = source.substr(i - 1, 2);
          onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "	") {
        const wsStart = i;
        let next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
        if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
          res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== "\n")
        break;
      if (ch === "\n")
        fold += "\n";
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  const escapeCodes = {
    "0": "\0",
    // null character
    a: "\x07",
    // bell character
    b: "\b",
    // backspace
    e: "\x1B",
    // escape character
    f: "\f",
    // form feed
    n: "\n",
    // line feed
    r: "\r",
    // carriage return
    t: "	",
    // horizontal tab
    v: "\v",
    // vertical tab
    N: "",
    // Unicode next line
    _: " ",
    // Unicode non-breaking space
    L: "\u2028",
    // Unicode line separator
    P: "\u2029",
    // Unicode paragraph separator
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "	": "	"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
      return String.fromCodePoint(code);
    } catch {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
  }
  resolveFlowScalar.resolveFlowScalar = resolveFlowScalar$1;
  return resolveFlowScalar;
}
var hasRequiredComposeScalar;
function requireComposeScalar() {
  if (hasRequiredComposeScalar) return composeScalar;
  hasRequiredComposeScalar = 1;
  var identity2 = requireIdentity();
  var Scalar2 = requireScalar();
  var resolveBlockScalar2 = requireResolveBlockScalar();
  var resolveFlowScalar2 = requireResolveFlowScalar();
  function composeScalar$1(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar2.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar2.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[identity2.SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[identity2.SCALAR];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = identity2.isScalar(res) ? res : new Scalar2.Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar2.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment)
      scalar.comment = comment;
    return scalar;
  }
  function findScalarTagByName(schema2, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema2[identity2.SCALAR];
    const matchWithTest = [];
    for (const tag of schema2.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema2.knownTags[tagName];
    if (kt && !kt.collection) {
      schema2.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema2[identity2.SCALAR];
  }
  function findScalarTagByTest({ atKey, directives: directives2, schema: schema2 }, value, token, onError) {
    const tag = schema2.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema2[identity2.SCALAR];
    if (schema2.compat) {
      const compat = schema2.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema2[identity2.SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives2.tagString(tag.tag);
        const cs = directives2.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }
  composeScalar.composeScalar = composeScalar$1;
  return composeScalar;
}
var utilEmptyScalarPosition = {};
var hasRequiredUtilEmptyScalarPosition;
function requireUtilEmptyScalarPosition() {
  if (hasRequiredUtilEmptyScalarPosition) return utilEmptyScalarPosition;
  hasRequiredUtilEmptyScalarPosition = 1;
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      pos ?? (pos = before.length);
      for (let i = pos - 1; i >= 0; --i) {
        let st = before[i];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i];
        }
        break;
      }
    }
    return offset;
  }
  utilEmptyScalarPosition.emptyScalarPosition = emptyScalarPosition;
  return utilEmptyScalarPosition;
}
var hasRequiredComposeNode;
function requireComposeNode() {
  if (hasRequiredComposeNode) return composeNode;
  hasRequiredComposeNode = 1;
  var Alias2 = requireAlias();
  var identity2 = requireIdentity();
  var composeCollection2 = requireComposeCollection();
  var composeScalar2 = requireComposeScalar();
  var resolveEnd2 = requireResolveEnd();
  var utilEmptyScalarPosition2 = requireUtilEmptyScalarPosition();
  const CN = { composeNode: composeNode$1, composeEmptyNode };
  function composeNode$1(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar2.composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        try {
          node = composeCollection2.composeCollection(CN, ctx, token, props, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onError(token, "RESOURCE_EXHAUSTION", message);
        }
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        isSrcToken = false;
      }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!identity2.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: utilEmptyScalarPosition2.emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar2.composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias2.Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd2.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }
  composeNode.composeEmptyNode = composeEmptyNode;
  composeNode.composeNode = composeNode$1;
  return composeNode;
}
var hasRequiredComposeDoc;
function requireComposeDoc() {
  if (hasRequiredComposeDoc) return composeDoc;
  hasRequiredComposeDoc = 1;
  var Document2 = requireDocument();
  var composeNode2 = requireComposeNode();
  var resolveEnd2 = requireResolveEnd();
  var resolveProps2 = requireResolveProps();
  function composeDoc$1(options, directives2, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives2 }, options);
    const doc = new Document2.Document(void 0, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps2.resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode2.composeNode(ctx, value, props, onError) : composeNode2.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd2.resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }
  composeDoc.composeDoc = composeDoc$1;
  return composeDoc;
}
var hasRequiredComposer;
function requireComposer() {
  if (hasRequiredComposer) return composer;
  hasRequiredComposer = 1;
  var node_process = require$$0;
  var directives2 = requireDirectives();
  var Document2 = requireDocument();
  var errors2 = requireErrors();
  var identity2 = requireIdentity();
  var composeDoc2 = requireComposeDoc();
  var resolveEnd2 = requireResolveEnd();
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0; i < prelude.length; ++i) {
      const source = prelude[i];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i + 1]?.[0] !== "#")
            i += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }
  class Composer {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new errors2.YAMLWarning(pos, code, message));
        else
          this.errors.push(new errors2.YAMLParseError(pos, code, message));
      };
      this.directives = new directives2.Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (identity2.isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (identity2.isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        for (let i = 0; i < this.errors.length; ++i)
          doc.errors.push(this.errors[i]);
        for (let i = 0; i < this.warnings.length; ++i)
          doc.warnings.push(this.warnings[i]);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
      if (node_process.env.LOG_STREAM)
        console.dir(token, { depth: null });
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc2.composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new errors2.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new errors2.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd2.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new errors2.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document2.Document(void 0, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  }
  composer.Composer = Composer;
  return composer;
}
var cst = {};
var cstScalar = {};
var hasRequiredCstScalar;
function requireCstScalar() {
  if (hasRequiredCstScalar) return cstScalar;
  hasRequiredCstScalar = 1;
  var resolveBlockScalar2 = requireResolveBlockScalar();
  var resolveFlowScalar2 = requireResolveFlowScalar();
  var errors2 = requireErrors();
  var stringifyString2 = requireStringifyString();
  function resolveAsScalar(token, strict = true, onError) {
    if (token) {
      const _onError = (pos, code, message) => {
        const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
        if (onError)
          onError(offset, code, message);
        else
          throw new errors2.YAMLParseError([offset, offset + 1], code, message);
      };
      switch (token.type) {
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return resolveFlowScalar2.resolveFlowScalar(token, strict, _onError);
        case "block-scalar":
          return resolveBlockScalar2.resolveBlockScalar({ options: { strict } }, token, _onError);
      }
    }
    return null;
  }
  function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
    const source = stringifyString2.stringifyString({ type, value }, {
      implicitKey,
      indent: indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
      { type: "newline", offset: -1, indent, source: "\n" }
    ];
    switch (source[0]) {
      case "|":
      case ">": {
        const he = source.indexOf("\n");
        const head = source.substring(0, he);
        const body = source.substring(he + 1) + "\n";
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, end))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        return { type: "block-scalar", offset, indent, props, source: body };
      }
      case '"':
        return { type: "double-quoted-scalar", offset, indent, source, end };
      case "'":
        return { type: "single-quoted-scalar", offset, indent, source, end };
      default:
        return { type: "scalar", offset, indent, source, end };
    }
  }
  function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = "indent" in token ? token.indent : null;
    if (afterKey && typeof indent === "number")
      indent += 2;
    if (!type)
      switch (token.type) {
        case "single-quoted-scalar":
          type = "QUOTE_SINGLE";
          break;
        case "double-quoted-scalar":
          type = "QUOTE_DOUBLE";
          break;
        case "block-scalar": {
          const header = token.props[0];
          if (header.type !== "block-scalar-header")
            throw new Error("Invalid block scalar header");
          type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
          break;
        }
        default:
          type = "PLAIN";
      }
    const source = stringifyString2.stringifyString({ type, value }, {
      implicitKey: implicitKey || indent === null,
      indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
      case "|":
      case ">":
        setBlockScalarValue(token, source);
        break;
      case '"':
        setFlowScalarValue(token, source, "double-quoted-scalar");
        break;
      case "'":
        setFlowScalarValue(token, source, "single-quoted-scalar");
        break;
      default:
        setFlowScalarValue(token, source, "scalar");
    }
  }
  function setBlockScalarValue(token, source) {
    const he = source.indexOf("\n");
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + "\n";
    if (token.type === "block-scalar") {
      const header = token.props[0];
      if (header.type !== "block-scalar-header")
        throw new Error("Invalid block scalar header");
      header.source = head;
      token.source = body;
    } else {
      const { offset } = token;
      const indent = "indent" in token ? token.indent : -1;
      const props = [
        { type: "block-scalar-header", offset, indent, source: head }
      ];
      if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
        props.push({ type: "newline", offset: -1, indent, source: "\n" });
      for (const key of Object.keys(token))
        if (key !== "type" && key !== "offset")
          delete token[key];
      Object.assign(token, { type: "block-scalar", indent, props, source: body });
    }
  }
  function addEndtoBlockProps(props, end) {
    if (end)
      for (const st of end)
        switch (st.type) {
          case "space":
          case "comment":
            props.push(st);
            break;
          case "newline":
            props.push(st);
            return true;
        }
    return false;
  }
  function setFlowScalarValue(token, source, type) {
    switch (token.type) {
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        token.type = type;
        token.source = source;
        break;
      case "block-scalar": {
        const end = token.props.slice(1);
        let oa = source.length;
        if (token.props[0].type === "block-scalar-header")
          oa -= token.props[0].source.length;
        for (const tok of end)
          tok.offset += oa;
        delete token.props;
        Object.assign(token, { type, source, end });
        break;
      }
      case "block-map":
      case "block-seq": {
        const offset = token.offset + source.length;
        const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
        delete token.items;
        Object.assign(token, { type, source, end: [nl] });
        break;
      }
      default: {
        const indent = "indent" in token ? token.indent : -1;
        const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type, indent, source, end });
      }
    }
  }
  cstScalar.createScalarToken = createScalarToken;
  cstScalar.resolveAsScalar = resolveAsScalar;
  cstScalar.setScalarValue = setScalarValue;
  return cstScalar;
}
var cstStringify = {};
var hasRequiredCstStringify;
function requireCstStringify() {
  if (hasRequiredCstStringify) return cstStringify;
  hasRequiredCstStringify = 1;
  const stringify2 = (cst2) => "type" in cst2 ? stringifyToken(cst2) : stringifyItem(cst2);
  function stringifyToken(token) {
    switch (token.type) {
      case "block-scalar": {
        let res = "";
        for (const tok of token.props)
          res += stringifyToken(tok);
        return res + token.source;
      }
      case "block-map":
      case "block-seq": {
        let res = "";
        for (const item of token.items)
          res += stringifyItem(item);
        return res;
      }
      case "flow-collection": {
        let res = token.start.source;
        for (const item of token.items)
          res += stringifyItem(item);
        for (const st of token.end)
          res += st.source;
        return res;
      }
      case "document": {
        let res = stringifyItem(token);
        if (token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
      default: {
        let res = token.source;
        if ("end" in token && token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
    }
  }
  function stringifyItem({ start, key, sep, value }) {
    let res = "";
    for (const st of start)
      res += st.source;
    if (key)
      res += stringifyToken(key);
    if (sep)
      for (const st of sep)
        res += st.source;
    if (value)
      res += stringifyToken(value);
    return res;
  }
  cstStringify.stringify = stringify2;
  return cstStringify;
}
var cstVisit = {};
var hasRequiredCstVisit;
function requireCstVisit() {
  if (hasRequiredCstVisit) return cstVisit;
  hasRequiredCstVisit = 1;
  const BREAK = /* @__PURE__ */ Symbol("break visit");
  const SKIP = /* @__PURE__ */ Symbol("skip children");
  const REMOVE = /* @__PURE__ */ Symbol("remove item");
  function visit2(cst2, visitor) {
    if ("type" in cst2 && cst2.type === "document")
      cst2 = { start: cst2.start, value: cst2.value };
    _visit(Object.freeze([]), cst2, visitor);
  }
  visit2.BREAK = BREAK;
  visit2.SKIP = SKIP;
  visit2.REMOVE = REMOVE;
  visit2.itemAtPath = (cst2, path2) => {
    let item = cst2;
    for (const [field, index] of path2) {
      const tok = item?.[field];
      if (tok && "items" in tok) {
        item = tok.items[index];
      } else
        return void 0;
    }
    return item;
  };
  visit2.parentCollection = (cst2, path2) => {
    const parent = visit2.itemAtPath(cst2, path2.slice(0, -1));
    const field = path2[path2.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path2, item, visitor) {
    let ctrl = visitor(item, path2);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item[field];
      if (token && "items" in token) {
        for (let i = 0; i < token.items.length; ++i) {
          const ci = _visit(Object.freeze(path2.concat([[field, i]])), token.items[i], visitor);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            token.items.splice(i, 1);
            i -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item, path2);
      }
    }
    return typeof ctrl === "function" ? ctrl(item, path2) : ctrl;
  }
  cstVisit.visit = visit2;
  return cstVisit;
}
var hasRequiredCst;
function requireCst() {
  if (hasRequiredCst) return cst;
  hasRequiredCst = 1;
  var cstScalar2 = requireCstScalar();
  var cstStringify2 = requireCstStringify();
  var cstVisit2 = requireCstVisit();
  const BOM = "\uFEFF";
  const DOCUMENT = "";
  const FLOW_END = "";
  const SCALAR = "";
  const isCollection = (token) => !!token && "items" in token;
  const isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
  function prettyToken(token) {
    switch (token) {
      case BOM:
        return "<BOM>";
      case DOCUMENT:
        return "<DOC>";
      case FLOW_END:
        return "<FLOW_END>";
      case SCALAR:
        return "<SCALAR>";
      default:
        return JSON.stringify(token);
    }
  }
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case "\n":
      case "\r\n":
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "	":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }
  cst.createScalarToken = cstScalar2.createScalarToken;
  cst.resolveAsScalar = cstScalar2.resolveAsScalar;
  cst.setScalarValue = cstScalar2.setScalarValue;
  cst.stringify = cstStringify2.stringify;
  cst.visit = cstVisit2.visit;
  cst.BOM = BOM;
  cst.DOCUMENT = DOCUMENT;
  cst.FLOW_END = FLOW_END;
  cst.SCALAR = SCALAR;
  cst.isCollection = isCollection;
  cst.isScalar = isScalar;
  cst.prettyToken = prettyToken;
  cst.tokenType = tokenType;
  return cst;
}
var lexer = {};
var hasRequiredLexer;
function requireLexer() {
  if (hasRequiredLexer) return lexer;
  hasRequiredLexer = 1;
  var cst2 = requireCst();
  function isEmpty(ch) {
    switch (ch) {
      case void 0:
      case " ":
      case "\n":
      case "\r":
      case "	":
        return true;
      default:
        return false;
    }
  }
  const hexDigits = new Set("0123456789ABCDEFabcdef");
  const tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  const flowIndicatorChars = new Set(",[]{}");
  const invalidAnchorChars = new Set(" ,[]{}\n\r	");
  const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
  class Lexer {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i = this.pos;
      let ch = this.buffer[i];
      while (ch === " " || ch === "	")
        ch = this.buffer[++i];
      if (!ch || ch === "#" || ch === "\n")
        return true;
      if (ch === "\r")
        return this.buffer[i + 1] === "\n";
      return false;
    }
    charAt(n) {
      return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === "\n" || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf("\n", this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
      return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n) {
      return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === cst2.BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "	") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "	")
            dirEnd -= 1;
          else
            break;
        }
        const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield cst2.DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n;
        return "block-start";
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n = yield* this.pushIndicators();
      switch (line[n]) {
        case "#":
          yield* this.pushCount(line.length - n);
        // fallthrough
        case void 0:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n += yield* this.parseBlockScalarHeader();
          n += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield cst2.FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n = 0;
      while (line[n] === ",") {
        n += yield* this.pushCount(1);
        n += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n += yield* this.pushIndicators();
      switch (line[n]) {
        case void 0:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        // fallthrough
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n = 0;
          while (this.buffer[end - 1 - n] === "\\")
            n += 1;
          if (n % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf("\n", this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf("\n", cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i = this.pos;
      while (true) {
        const ch = this.buffer[++i];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
        switch (ch) {
          case " ":
            indent += 1;
            break;
          case "\n":
            nl = i2;
            indent = 0;
            break;
          case "\r": {
            const next = this.buffer[i2 + 1];
            if (!next && !this.atEnd)
              return this.setNext("block-scalar");
            if (next === "\n")
              break;
          }
          // fallthrough
          default:
            break loop;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf("\n", cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i = nl + 1;
      ch = this.buffer[i];
      while (ch === " ")
        ch = this.buffer[++i];
      if (ch === "	") {
        while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
          ch = this.buffer[++i];
        nl = i - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i2 = nl - 1;
          let ch2 = this.buffer[i2];
          if (ch2 === "\r")
            ch2 = this.buffer[--i2];
          const lastChar = i2;
          while (ch2 === " ")
            ch2 = this.buffer[--i2];
          if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
            nl = i2;
          else
            break;
        } while (true);
      }
      yield cst2.SCALAR;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i]) {
        if (ch === ":") {
          const next = this.buffer[i + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i + 1];
          if (ch === "\r") {
            if (next === "\n") {
              i += 1;
              ch = "\n";
              next = this.buffer[i + 1];
            } else
              end = i;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === "\n") {
            const cs = this.continueScalar(i + 1);
            if (cs === -1)
              break;
            i = Math.max(i, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield cst2.SCALAR;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n) {
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos += n;
        return n;
      }
      return 0;
    }
    *pushToIndex(i, allowEmpty) {
      const s = this.buffer.slice(this.pos, i);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      let n = 0;
      loop: while (true) {
        switch (this.charAt(0)) {
          case "!":
            n += yield* this.pushTag();
            n += yield* this.pushSpaces(true);
            continue loop;
          case "&":
            n += yield* this.pushUntil(isNotAnchorChar);
            n += yield* this.pushSpaces(true);
            continue loop;
          case "-":
          // this is an error
          case "?":
          // this is an error outside flow collections
          case ":": {
            const inFlow = this.flowLevel > 0;
            const ch1 = this.charAt(1);
            if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
              if (!inFlow)
                this.indentNext = this.indentValue + 1;
              else if (this.flowKey)
                this.flowKey = false;
              n += yield* this.pushCount(1);
              n += yield* this.pushSpaces(true);
              continue loop;
            }
          }
        }
        break loop;
      }
      return n;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i = this.pos + 2;
        let ch = this.buffer[i];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i];
        return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
      } else {
        let i = this.pos + 1;
        let ch = this.buffer[i];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i];
          else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
            ch = this.buffer[i += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === "\n")
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === "\n")
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i];
      } while (ch === " " || allowTabs && ch === "	");
      const n = i - this.pos;
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos = i;
      }
      return n;
    }
    *pushUntil(test) {
      let i = this.pos;
      let ch = this.buffer[i];
      while (!test(ch))
        ch = this.buffer[++i];
      return yield* this.pushToIndex(i, false);
    }
  }
  lexer.Lexer = Lexer;
  return lexer;
}
var lineCounter = {};
var hasRequiredLineCounter;
function requireLineCounter() {
  if (hasRequiredLineCounter) return lineCounter;
  hasRequiredLineCounter = 1;
  class LineCounter {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  }
  lineCounter.LineCounter = LineCounter;
  return lineCounter;
}
var parser = {};
var hasRequiredParser;
function requireParser() {
  if (hasRequiredParser) return parser;
  hasRequiredParser = 1;
  var node_process = require$$0;
  var cst2 = requireCst();
  var lexer2 = requireLexer();
  function includesToken(list, type) {
    for (let i = 0; i < list.length; ++i)
      if (list[i].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list) {
    for (let i = 0; i < list.length; ++i) {
      switch (list[i].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      /* istanbul ignore next should not happen */
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i = prev.length;
    loop: while (--i >= 0) {
      switch (prev[i].type) {
        case "doc-start":
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
        case "newline":
          break loop;
      }
    }
    while (prev[++i]?.type === "space") {
    }
    return prev.splice(i, prev.length);
  }
  function arrayPushArray(target, source) {
    if (source.length < 1e5)
      Array.prototype.push.apply(target, source);
    else
      for (let i = 0; i < source.length; ++i)
        target.push(source[i]);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              arrayPushArray(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            arrayPushArray(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }
  class Parser {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new lexer2.Lexer();
      this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
      this.source = source;
      if (node_process.env.LOG_TOKENS)
        console.log("|", cst2.prettyToken(source));
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = cst2.tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && top?.type !== "doc-end") {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n) {
      return this.stack[this.stack.length - n];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map2 = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf("\n") + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf("\n", nl) + 1;
            }
          }
          yield* this.pop();
          break;
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map2) {
      const it = map2.items[map2.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map2.indent)) {
              const prev = map2.items[map2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                map2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map2.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i = 0; i < it.sep.length; ++i) {
            const st = it.sep[i];
            switch (st.type) {
              case "newline":
                nl.push(i);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map2.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map2.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map2.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map2);
            if (bv) {
              if (bv.type === "block-seq") {
                if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                  yield* this.pop({
                    type: "error",
                    offset: this.offset,
                    message: "Unexpected block-seq-ind on same line with key",
                    source: this.source
                  });
                  return;
                }
              } else if (atMapIndent) {
                map2.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq2) {
      const it = seq2.items[seq2.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq2.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq2.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq2.indent)) {
              const prev = seq2.items[seq2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                seq2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq2.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq2.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq2.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq2.indent) {
        const bv = this.startBlockValue(seq2);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top?.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map2 = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map2;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf("\n") + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf("\n", nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        // fallthrough
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  }
  parser.Parser = Parser;
  return parser;
}
var publicApi = {};
var hasRequiredPublicApi;
function requirePublicApi() {
  if (hasRequiredPublicApi) return publicApi;
  hasRequiredPublicApi = 1;
  var composer2 = requireComposer();
  var Document2 = requireDocument();
  var errors2 = requireErrors();
  var log2 = requireLog();
  var identity2 = requireIdentity();
  var lineCounter2 = requireLineCounter();
  var parser2 = requireParser();
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter2.LineCounter() || null;
    return { lineCounter: lineCounter$1, prettyErrors };
  }
  function parseAllDocuments(source, options = {}) {
    const { lineCounter: lineCounter3, prettyErrors } = parseOptions(options);
    const parser$1 = new parser2.Parser(lineCounter3?.addNewLine);
    const composer$1 = new composer2.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter3)
      for (const doc of docs) {
        doc.errors.forEach(errors2.prettifyError(source, lineCounter3));
        doc.warnings.forEach(errors2.prettifyError(source, lineCounter3));
      }
    if (docs.length > 0)
      return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
  }
  function parseDocument(source, options = {}) {
    const { lineCounter: lineCounter3, prettyErrors } = parseOptions(options);
    const parser$1 = new parser2.Parser(lineCounter3?.addNewLine);
    const composer$1 = new composer2.Composer(options);
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new errors2.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter3) {
      doc.errors.forEach(errors2.prettifyError(source, lineCounter3));
      doc.warnings.forEach(errors2.prettifyError(source, lineCounter3));
    }
    return doc;
  }
  function parse2(src, reviver, options) {
    let _reviver = void 0;
    if (typeof reviver === "function") {
      _reviver = reviver;
    } else if (options === void 0 && reviver && typeof reviver === "object") {
      options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
      return null;
    doc.warnings.forEach((warning) => log2.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
      if (doc.options.logLevel !== "silent")
        throw doc.errors[0];
      else
        doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
  }
  function stringify2(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
    }
    if (typeof options === "string")
      options = options.length;
    if (typeof options === "number") {
      const indent = Math.round(options);
      options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === void 0) {
      const { keepUndefined } = options ?? replacer ?? {};
      if (!keepUndefined)
        return void 0;
    }
    if (identity2.isDocument(value) && !_replacer)
      return value.toString(options);
    return new Document2.Document(value, _replacer, options).toString(options);
  }
  publicApi.parse = parse2;
  publicApi.parseAllDocuments = parseAllDocuments;
  publicApi.parseDocument = parseDocument;
  publicApi.stringify = stringify2;
  return publicApi;
}
var hasRequiredDist;
function requireDist() {
  if (hasRequiredDist) return dist;
  hasRequiredDist = 1;
  var composer2 = requireComposer();
  var Document2 = requireDocument();
  var Schema2 = requireSchema();
  var errors2 = requireErrors();
  var Alias2 = requireAlias();
  var identity2 = requireIdentity();
  var Pair2 = requirePair();
  var Scalar2 = requireScalar();
  var YAMLMap2 = requireYAMLMap();
  var YAMLSeq2 = requireYAMLSeq();
  var cst2 = requireCst();
  var lexer2 = requireLexer();
  var lineCounter2 = requireLineCounter();
  var parser2 = requireParser();
  var publicApi2 = requirePublicApi();
  var visit2 = requireVisit();
  dist.Composer = composer2.Composer;
  dist.Document = Document2.Document;
  dist.Schema = Schema2.Schema;
  dist.YAMLError = errors2.YAMLError;
  dist.YAMLParseError = errors2.YAMLParseError;
  dist.YAMLWarning = errors2.YAMLWarning;
  dist.Alias = Alias2.Alias;
  dist.isAlias = identity2.isAlias;
  dist.isCollection = identity2.isCollection;
  dist.isDocument = identity2.isDocument;
  dist.isMap = identity2.isMap;
  dist.isNode = identity2.isNode;
  dist.isPair = identity2.isPair;
  dist.isScalar = identity2.isScalar;
  dist.isSeq = identity2.isSeq;
  dist.Pair = Pair2.Pair;
  dist.Scalar = Scalar2.Scalar;
  dist.YAMLMap = YAMLMap2.YAMLMap;
  dist.YAMLSeq = YAMLSeq2.YAMLSeq;
  dist.CST = cst2;
  dist.Lexer = lexer2.Lexer;
  dist.LineCounter = lineCounter2.LineCounter;
  dist.Parser = parser2.Parser;
  dist.parse = publicApi2.parse;
  dist.parseAllDocuments = publicApi2.parseAllDocuments;
  dist.parseDocument = publicApi2.parseDocument;
  dist.stringify = publicApi2.stringify;
  dist.visit = visit2.visit;
  dist.visitAsync = visit2.visitAsync;
  return dist;
}
var distExports = requireDist();
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k2) => typeof obj[obj[k2]] !== "number");
    const filtered = {};
    for (const k2 of validKeys) {
      filtered[k2] = obj[k2];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e2) {
      return obj[e2];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
const getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
const ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
const errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
let overrideErrorMap = errorMap;
function getErrorMap() {
  return overrideErrorMap;
}
const makeIssue = (params) => {
  const { data, path: path2, errorMaps, issueData } = params;
  const fullPath = [...path2, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map2 of maps) {
    errorMessage = map2(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs2) {
    const syncPairs = [];
    for (const pair of pairs2) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs2) {
    const finalObject = {};
    for (const pair of pairs2) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
const INVALID = Object.freeze({
  status: "aborted"
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));
class ParseInputLazyPath {
  constructor(parent, value, path2, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path2;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
const handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema2, params) => {
  return new ZodArray({
    type: schema2,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema2) {
  if (schema2 instanceof ZodObject) {
    const newShape = {};
    for (const key in schema2.shape) {
      const fieldSchema = schema2.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema2._def,
      shape: () => newShape
    });
  } else if (schema2 instanceof ZodArray) {
    return new ZodArray({
      ...schema2._def,
      type: deepPartialify(schema2.element)
    });
  } else if (schema2 instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodTuple) {
    return ZodTuple.create(schema2.items.map((item) => deepPartialify(item)));
  } else {
    return schema2;
  }
}
class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs2 = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs2.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs2.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs2.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs2) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs2);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema2) {
    return this.augment({ [key]: schema2 });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema2 = this._def.items[itemIndex] || this._def.rest;
      if (!schema2)
        return null;
      return schema2._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs2 = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs2.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs2);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs2);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
}
class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs2 = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs2) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs2) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
class ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
}
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema2, params) => {
  return new ZodPromise({
    type: schema2,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema2, effect, params) => {
  return new ZodEffects({
    schema: schema2,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema2, params) => {
  return new ZodEffects({
    schema: schema2,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}
class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const stringType = ZodString.create;
const numberType = ZodNumber.create;
ZodNever.create;
ZodArray.create;
const objectType = ZodObject.create;
const unionType = ZodUnion.create;
ZodIntersection.create;
ZodTuple.create;
const recordType = ZodRecord.create;
ZodEnum.create;
ZodPromise.create;
ZodOptional.create;
ZodNullable.create;
function splitFrontMatter(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const open = `---${eol}`;
  if (!text.startsWith(open)) {
    return { hasFrontMatter: false, yaml: "", yamlStart: 0, yamlEnd: 0, body: text, bodyStart: 0, eol };
  }
  const yamlStart = open.length;
  const closeRe = eol === "\r\n" ? /\r\n---(\r\n|$)/g : /\n---(\n|$)/g;
  closeRe.lastIndex = yamlStart - eol.length;
  const m = closeRe.exec(text);
  if (!m) return { hasFrontMatter: false, yaml: "", yamlStart: 0, yamlEnd: 0, body: text, bodyStart: 0, eol };
  const yamlEnd = m.index + eol.length;
  const bodyStart = m.index + m[0].length;
  return { hasFrontMatter: true, yaml: text.slice(yamlStart, yamlEnd), yamlStart, yamlEnd, body: text.slice(bodyStart), bodyStart, eol };
}
const parseNumber = (color, len) => {
  if (typeof color !== "number") return;
  if (len === 3) {
    return {
      mode: "rgb",
      r: (color >> 8 & 15 | color >> 4 & 240) / 255,
      g: (color >> 4 & 15 | color & 240) / 255,
      b: (color & 15 | color << 4 & 240) / 255
    };
  }
  if (len === 4) {
    return {
      mode: "rgb",
      r: (color >> 12 & 15 | color >> 8 & 240) / 255,
      g: (color >> 8 & 15 | color >> 4 & 240) / 255,
      b: (color >> 4 & 15 | color & 240) / 255,
      alpha: (color & 15 | color << 4 & 240) / 255
    };
  }
  if (len === 6) {
    return {
      mode: "rgb",
      r: (color >> 16 & 255) / 255,
      g: (color >> 8 & 255) / 255,
      b: (color & 255) / 255
    };
  }
  if (len === 8) {
    return {
      mode: "rgb",
      r: (color >> 24 & 255) / 255,
      g: (color >> 16 & 255) / 255,
      b: (color >> 8 & 255) / 255,
      alpha: (color & 255) / 255
    };
  }
};
const named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  // Added in CSS Colors Level 4:
  // https://drafts.csswg.org/css-color/#changes-from-3
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
const parseNamed = (color) => {
  return parseNumber(named[color.toLowerCase()], 6);
};
const hex = /^#?([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})$/i;
const parseHex = (color) => {
  let match;
  return (match = color.match(hex)) ? parseNumber(parseInt(match[1], 16), match[1].length) : void 0;
};
const num$1 = "([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)";
const per = `${num$1}%`;
const num_per = `(?:${num$1}%|${num$1})`;
const hue$1 = `(?:${num$1}(deg|grad|rad|turn)|${num$1})`;
const c = `\\s*,\\s*`;
const rgb_num_old = new RegExp(
  `^rgba?\\(\\s*${num$1}${c}${num$1}${c}${num$1}\\s*(?:,\\s*${num_per}\\s*)?\\)$`
);
const rgb_per_old = new RegExp(
  `^rgba?\\(\\s*${per}${c}${per}${c}${per}\\s*(?:,\\s*${num_per}\\s*)?\\)$`
);
const parseRgbLegacy = (color) => {
  let res = { mode: "rgb" };
  let match;
  if (match = color.match(rgb_num_old)) {
    if (match[1] !== void 0) {
      res.r = match[1] / 255;
    }
    if (match[2] !== void 0) {
      res.g = match[2] / 255;
    }
    if (match[3] !== void 0) {
      res.b = match[3] / 255;
    }
  } else if (match = color.match(rgb_per_old)) {
    if (match[1] !== void 0) {
      res.r = match[1] / 100;
    }
    if (match[2] !== void 0) {
      res.g = match[2] / 100;
    }
    if (match[3] !== void 0) {
      res.b = match[3] / 100;
    }
  } else {
    return void 0;
  }
  if (match[4] !== void 0) {
    res.alpha = Math.max(0, Math.min(1, match[4] / 100));
  } else if (match[5] !== void 0) {
    res.alpha = Math.max(0, Math.min(1, +match[5]));
  }
  return res;
};
const prepare = (color, mode) => color === void 0 ? void 0 : typeof color !== "object" ? parse(color) : color.mode !== void 0 ? color : mode ? { ...color, mode } : void 0;
const converter = (target_mode = "rgb") => (color) => (color = prepare(color, target_mode)) !== void 0 ? (
  // if the color's mode corresponds to our target mode
  color.mode === target_mode ? (
    // then just return the color
    color
  ) : (
    // otherwise check to see if we have a dedicated
    // converter for the target mode
    converters[color.mode][target_mode] ? (
      // and return its result...
      converters[color.mode][target_mode](color)
    ) : (
      // ...otherwise pass through RGB as an intermediary step.
      // if the target mode is RGB...
      target_mode === "rgb" ? (
        // just return the RGB
        converters[color.mode].rgb(color)
      ) : (
        // otherwise convert color.mode -> RGB -> target_mode
        converters.rgb[target_mode](converters[color.mode].rgb(color))
      )
    )
  )
) : void 0;
const converters = {};
const modes = {};
const parsers = [];
const colorProfiles = {};
const identity = (v) => v;
const useMode = (definition2) => {
  converters[definition2.mode] = {
    ...converters[definition2.mode],
    ...definition2.toMode
  };
  Object.keys(definition2.fromMode || {}).forEach((k2) => {
    if (!converters[k2]) {
      converters[k2] = {};
    }
    converters[k2][definition2.mode] = definition2.fromMode[k2];
  });
  if (!definition2.ranges) {
    definition2.ranges = {};
  }
  if (!definition2.difference) {
    definition2.difference = {};
  }
  definition2.channels.forEach((channel) => {
    if (definition2.ranges[channel] === void 0) {
      definition2.ranges[channel] = [0, 1];
    }
    if (!definition2.interpolate[channel]) {
      throw new Error(`Missing interpolator for: ${channel}`);
    }
    if (typeof definition2.interpolate[channel] === "function") {
      definition2.interpolate[channel] = {
        use: definition2.interpolate[channel]
      };
    }
    if (!definition2.interpolate[channel].fixup) {
      definition2.interpolate[channel].fixup = identity;
    }
  });
  modes[definition2.mode] = definition2;
  (definition2.parse || []).forEach((parser2) => {
    useParser(parser2, definition2.mode);
  });
  return converter(definition2.mode);
};
const getMode = (mode) => modes[mode];
const useParser = (parser2, mode) => {
  if (typeof parser2 === "string") {
    if (!mode) {
      throw new Error(`'mode' required when 'parser' is a string`);
    }
    colorProfiles[parser2] = mode;
  } else if (typeof parser2 === "function") {
    if (parsers.indexOf(parser2) < 0) {
      parsers.push(parser2);
    }
  }
};
const IdentStartCodePoint = /[^\x00-\x7F]|[a-zA-Z_]/;
const IdentCodePoint = /[^\x00-\x7F]|[-\w]/;
const Tok = {
  Function: "function",
  Ident: "ident",
  Number: "number",
  Percentage: "percentage",
  ParenClose: ")",
  None: "none",
  Hue: "hue",
  Alpha: "alpha"
};
let _i = 0;
function is_num(chars) {
  let ch = chars[_i];
  let ch1 = chars[_i + 1];
  if (ch === "-" || ch === "+") {
    return /\d/.test(ch1) || ch1 === "." && /\d/.test(chars[_i + 2]);
  }
  if (ch === ".") {
    return /\d/.test(ch1);
  }
  return /\d/.test(ch);
}
function is_ident(chars) {
  if (_i >= chars.length) {
    return false;
  }
  let ch = chars[_i];
  if (IdentStartCodePoint.test(ch)) {
    return true;
  }
  if (ch === "-") {
    if (chars.length - _i < 2) {
      return false;
    }
    let ch1 = chars[_i + 1];
    if (ch1 === "-" || IdentStartCodePoint.test(ch1)) {
      return true;
    }
    return false;
  }
  return false;
}
const huenits = {
  deg: 1,
  rad: 180 / Math.PI,
  grad: 9 / 10,
  turn: 360
};
function num(chars) {
  let value = "";
  if (chars[_i] === "-" || chars[_i] === "+") {
    value += chars[_i++];
  }
  value += digits(chars);
  if (chars[_i] === "." && /\d/.test(chars[_i + 1])) {
    value += chars[_i++] + digits(chars);
  }
  if (chars[_i] === "e" || chars[_i] === "E") {
    if ((chars[_i + 1] === "-" || chars[_i + 1] === "+") && /\d/.test(chars[_i + 2])) {
      value += chars[_i++] + chars[_i++] + digits(chars);
    } else if (/\d/.test(chars[_i + 1])) {
      value += chars[_i++] + digits(chars);
    }
  }
  if (is_ident(chars)) {
    let id = ident(chars);
    if (id === "deg" || id === "rad" || id === "turn" || id === "grad") {
      return { type: Tok.Hue, value: value * huenits[id] };
    }
    return void 0;
  }
  if (chars[_i] === "%") {
    _i++;
    return { type: Tok.Percentage, value: +value };
  }
  return { type: Tok.Number, value: +value };
}
function digits(chars) {
  let v = "";
  while (/\d/.test(chars[_i])) {
    v += chars[_i++];
  }
  return v;
}
function ident(chars) {
  let v = "";
  while (_i < chars.length && IdentCodePoint.test(chars[_i])) {
    v += chars[_i++];
  }
  return v;
}
function identlike(chars) {
  let v = ident(chars);
  if (chars[_i] === "(") {
    _i++;
    return { type: Tok.Function, value: v };
  }
  if (v === "none") {
    return { type: Tok.None, value: void 0 };
  }
  return { type: Tok.Ident, value: v };
}
function tokenize(str = "") {
  let chars = str.trim();
  let tokens = [];
  let ch;
  _i = 0;
  while (_i < chars.length) {
    ch = chars[_i++];
    if (ch === "\n" || ch === "	" || ch === " ") {
      while (_i < chars.length && (chars[_i] === "\n" || chars[_i] === "	" || chars[_i] === " ")) {
        _i++;
      }
      continue;
    }
    if (ch === ",") {
      return void 0;
    }
    if (ch === ")") {
      tokens.push({ type: Tok.ParenClose });
      continue;
    }
    if (ch === "+") {
      _i--;
      if (is_num(chars)) {
        tokens.push(num(chars));
        continue;
      }
      return void 0;
    }
    if (ch === "-") {
      _i--;
      if (is_num(chars)) {
        tokens.push(num(chars));
        continue;
      }
      if (is_ident(chars)) {
        tokens.push({ type: Tok.Ident, value: ident(chars) });
        continue;
      }
      return void 0;
    }
    if (ch === ".") {
      _i--;
      if (is_num(chars)) {
        tokens.push(num(chars));
        continue;
      }
      return void 0;
    }
    if (ch === "/") {
      while (_i < chars.length && (chars[_i] === "\n" || chars[_i] === "	" || chars[_i] === " ")) {
        _i++;
      }
      let alpha;
      if (is_num(chars)) {
        alpha = num(chars);
        if (alpha.type !== Tok.Hue) {
          tokens.push({ type: Tok.Alpha, value: alpha });
          continue;
        }
      }
      if (is_ident(chars)) {
        if (ident(chars) === "none") {
          tokens.push({
            type: Tok.Alpha,
            value: { type: Tok.None, value: void 0 }
          });
          continue;
        }
      }
      return void 0;
    }
    if (/\d/.test(ch)) {
      _i--;
      tokens.push(num(chars));
      continue;
    }
    if (IdentStartCodePoint.test(ch)) {
      _i--;
      tokens.push(identlike(chars));
      continue;
    }
    return void 0;
  }
  return tokens;
}
function parseColorSyntax(tokens) {
  tokens._i = 0;
  let token = tokens[tokens._i++];
  if (!token || token.type !== Tok.Function || token.value !== "color") {
    return void 0;
  }
  token = tokens[tokens._i++];
  if (token.type !== Tok.Ident) {
    return void 0;
  }
  const mode = colorProfiles[token.value];
  if (!mode) {
    return void 0;
  }
  const res = { mode };
  const coords = consumeCoords(tokens, false);
  if (!coords) {
    return void 0;
  }
  const channels = getMode(mode).channels;
  for (let ii = 0, c2, ch; ii < channels.length; ii++) {
    c2 = coords[ii];
    ch = channels[ii];
    if (c2.type !== Tok.None) {
      res[ch] = c2.type === Tok.Number ? c2.value : c2.value / 100;
      if (ch === "alpha") {
        res[ch] = Math.max(0, Math.min(1, res[ch]));
      }
    }
  }
  return res;
}
function consumeCoords(tokens, includeHue) {
  const coords = [];
  let token;
  while (tokens._i < tokens.length) {
    token = tokens[tokens._i++];
    if (token.type === Tok.None || token.type === Tok.Number || token.type === Tok.Alpha || token.type === Tok.Percentage || includeHue && token.type === Tok.Hue) {
      coords.push(token);
      continue;
    }
    if (token.type === Tok.ParenClose) {
      if (tokens._i < tokens.length) {
        return void 0;
      }
      continue;
    }
    return void 0;
  }
  if (coords.length < 3 || coords.length > 4) {
    return void 0;
  }
  if (coords.length === 4) {
    if (coords[3].type !== Tok.Alpha) {
      return void 0;
    }
    coords[3] = coords[3].value;
  }
  if (coords.length === 3) {
    coords.push({ type: Tok.None, value: void 0 });
  }
  return coords.every((c2) => c2.type !== Tok.Alpha) ? coords : void 0;
}
function parseModernSyntax(tokens, includeHue) {
  tokens._i = 0;
  let token = tokens[tokens._i++];
  if (!token || token.type !== Tok.Function) {
    return void 0;
  }
  let coords = consumeCoords(tokens, includeHue);
  if (!coords) {
    return void 0;
  }
  coords.unshift(token.value);
  return coords;
}
const parse = (color) => {
  if (typeof color !== "string") {
    return void 0;
  }
  const tokens = tokenize(color);
  const parsed = tokens ? parseModernSyntax(tokens, true) : void 0;
  let result = void 0;
  let i = 0;
  let len = parsers.length;
  while (i < len) {
    if ((result = parsers[i++](color, parsed)) !== void 0) {
      return result;
    }
  }
  return tokens ? parseColorSyntax(tokens) : void 0;
};
function parseRgb(color, parsed) {
  if (!parsed || parsed[0] !== "rgb" && parsed[0] !== "rgba") {
    return void 0;
  }
  const res = { mode: "rgb" };
  const [, r, g, b, alpha] = parsed;
  if (r.type === Tok.Hue || g.type === Tok.Hue || b.type === Tok.Hue) {
    return void 0;
  }
  if (r.type !== Tok.None) {
    res.r = r.type === Tok.Number ? r.value / 255 : r.value / 100;
  }
  if (g.type !== Tok.None) {
    res.g = g.type === Tok.Number ? g.value / 255 : g.value / 100;
  }
  if (b.type !== Tok.None) {
    res.b = b.type === Tok.Number ? b.value / 255 : b.value / 100;
  }
  if (alpha.type !== Tok.None) {
    res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    );
  }
  return res;
}
const parseTransparent = (c2) => c2 === "transparent" ? { mode: "rgb", r: 0, g: 0, b: 0, alpha: 0 } : void 0;
const lerp = (a, b, t) => a + t * (b - a);
const get_classes = (arr) => {
  let classes = [];
  for (let i = 0; i < arr.length - 1; i++) {
    let a = arr[i];
    let b = arr[i + 1];
    if (a === void 0 && b === void 0) {
      classes.push(void 0);
    } else if (a !== void 0 && b !== void 0) {
      classes.push([a, b]);
    } else {
      classes.push(a !== void 0 ? [a, a] : [b, b]);
    }
  }
  return classes;
};
const interpolatorPiecewise = (interpolator) => (arr) => {
  let classes = get_classes(arr);
  return (t) => {
    let cls = t * classes.length;
    let idx = t >= 1 ? classes.length - 1 : Math.max(Math.floor(cls), 0);
    let pair = classes[idx];
    return pair === void 0 ? void 0 : interpolator(pair[0], pair[1], cls - idx);
  };
};
const interpolatorLinear = interpolatorPiecewise(lerp);
const fixupAlpha = (arr) => {
  let some_defined = false;
  let res = arr.map((v) => {
    if (v !== void 0) {
      some_defined = true;
      return v;
    }
    return 1;
  });
  return some_defined ? res : arr;
};
const definition$r = {
  mode: "rgb",
  channels: ["r", "g", "b", "alpha"],
  parse: [
    parseRgb,
    parseHex,
    parseRgbLegacy,
    parseNamed,
    parseTransparent,
    "srgb"
  ],
  serialize: "srgb",
  interpolate: {
    r: interpolatorLinear,
    g: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  gamut: true,
  white: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 }
};
const linearize$2 = (v = 0) => Math.pow(Math.abs(v), 563 / 256) * Math.sign(v);
const convertA98ToXyz65 = (a98) => {
  let r = linearize$2(a98.r);
  let g = linearize$2(a98.g);
  let b = linearize$2(a98.b);
  let res = {
    mode: "xyz65",
    x: 0.5766690429101305 * r + 0.1855582379065463 * g + 0.1882286462349947 * b,
    y: 0.297344975250536 * r + 0.6273635662554661 * g + 0.0752914584939979 * b,
    z: 0.0270313613864123 * r + 0.0706888525358272 * g + 0.9913375368376386 * b
  };
  if (a98.alpha !== void 0) {
    res.alpha = a98.alpha;
  }
  return res;
};
const gamma$2 = (v) => Math.pow(Math.abs(v), 256 / 563) * Math.sign(v);
const convertXyz65ToA98 = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = {
    mode: "a98",
    r: gamma$2(
      x * 2.0415879038107465 - y * 0.5650069742788597 - 0.3447313507783297 * z
    ),
    g: gamma$2(
      x * -0.9692436362808798 + y * 1.8759675015077206 + 0.0415550574071756 * z
    ),
    b: gamma$2(
      x * 0.0134442806320312 - y * 0.1183623922310184 + 1.0151749943912058 * z
    )
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const fn$3 = (c2 = 0) => {
  const abs2 = Math.abs(c2);
  if (abs2 <= 0.04045) {
    return c2 / 12.92;
  }
  return (Math.sign(c2) || 1) * Math.pow((abs2 + 0.055) / 1.055, 2.4);
};
const convertRgbToLrgb = ({ r, g, b, alpha }) => {
  let res = {
    mode: "lrgb",
    r: fn$3(r),
    g: fn$3(g),
    b: fn$3(b)
  };
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const convertRgbToXyz65 = (rgb2) => {
  let { r, g, b, alpha } = convertRgbToLrgb(rgb2);
  let res = {
    mode: "xyz65",
    x: 0.4123907992659593 * r + 0.357584339383878 * g + 0.1804807884018343 * b,
    y: 0.2126390058715102 * r + 0.715168678767756 * g + 0.0721923153607337 * b,
    z: 0.0193308187155918 * r + 0.119194779794626 * g + 0.9505321522496607 * b
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const fn$2 = (c2 = 0) => {
  const abs2 = Math.abs(c2);
  if (abs2 > 31308e-7) {
    return (Math.sign(c2) || 1) * (1.055 * Math.pow(abs2, 1 / 2.4) - 0.055);
  }
  return c2 * 12.92;
};
const convertLrgbToRgb = ({ r, g, b, alpha }, mode = "rgb") => {
  let res = {
    mode,
    r: fn$2(r),
    g: fn$2(g),
    b: fn$2(b)
  };
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const convertXyz65ToRgb = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = convertLrgbToRgb({
    r: x * 3.2409699419045226 - y * 1.537383177570094 - 0.4986107602930034 * z,
    g: x * -0.9692436362808796 + y * 1.8759675015077204 + 0.0415550574071756 * z,
    b: x * 0.0556300796969936 - y * 0.2039769588889765 + 1.0569715142428784 * z
  });
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const definition$q = {
  ...definition$r,
  mode: "a98",
  parse: ["a98-rgb"],
  serialize: "a98-rgb",
  fromMode: {
    rgb: (color) => convertXyz65ToA98(convertRgbToXyz65(color)),
    xyz65: convertXyz65ToA98
  },
  toMode: {
    rgb: (color) => convertXyz65ToRgb(convertA98ToXyz65(color)),
    xyz65: convertA98ToXyz65
  }
};
const normalizeHue = (hue2) => (hue2 = hue2 % 360) < 0 ? hue2 + 360 : hue2;
const hue = (hues, fn2) => {
  return hues.map((hue2, idx, arr) => {
    if (hue2 === void 0) {
      return hue2;
    }
    let normalized = normalizeHue(hue2);
    if (idx === 0 || hues[idx - 1] === void 0) {
      return normalized;
    }
    return fn2(normalized - normalizeHue(arr[idx - 1]));
  }).reduce((acc, curr) => {
    if (!acc.length || curr === void 0 || acc[acc.length - 1] === void 0) {
      acc.push(curr);
      return acc;
    }
    acc.push(curr + acc[acc.length - 1]);
    return acc;
  }, []);
};
const fixupHueShorter = (arr) => hue(arr, (d) => Math.abs(d) <= 180 ? d : d - 360 * Math.sign(d));
const M = [-0.14861, 1.78277, -0.29227, -0.90649, 1.97294, 0];
const degToRad = Math.PI / 180;
const radToDeg = 180 / Math.PI;
let DE = M[3] * M[4];
let BE = M[1] * M[4];
let BCAD = M[1] * M[2] - M[0] * M[3];
const convertRgbToCubehelix = ({ r, g, b, alpha }) => {
  if (r === void 0) r = 0;
  if (g === void 0) g = 0;
  if (b === void 0) b = 0;
  let l = (BCAD * b + r * DE - g * BE) / (BCAD + DE - BE);
  let x = b - l;
  let y = (M[4] * (g - l) - M[2] * x) / M[3];
  let res = {
    mode: "cubehelix",
    l,
    s: l === 0 || l === 1 ? void 0 : Math.sqrt(x * x + y * y) / (M[4] * l * (1 - l))
  };
  if (res.s) res.h = Math.atan2(y, x) * radToDeg - 120;
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const convertCubehelixToRgb = ({ h, s, l, alpha }) => {
  let res = { mode: "rgb" };
  h = (h === void 0 ? 0 : h + 120) * degToRad;
  if (l === void 0) l = 0;
  let amp = s === void 0 ? 0 : s * l * (1 - l);
  let cosh = Math.cos(h);
  let sinh = Math.sin(h);
  res.r = l + amp * (M[0] * cosh + M[1] * sinh);
  res.g = l + amp * (M[2] * cosh + M[3] * sinh);
  res.b = l + amp * (M[4] * cosh + M[5] * sinh);
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const differenceHueSaturation = (std, smp) => {
  if (std.h === void 0 || smp.h === void 0 || !std.s || !smp.s) {
    return 0;
  }
  let std_h = normalizeHue(std.h);
  let smp_h = normalizeHue(smp.h);
  let dH = Math.sin((smp_h - std_h + 360) / 2 * Math.PI / 180);
  return 2 * Math.sqrt(std.s * smp.s) * dH;
};
const differenceHueNaive = (std, smp) => {
  if (std.h === void 0 || smp.h === void 0) {
    return 0;
  }
  let std_h = normalizeHue(std.h);
  let smp_h = normalizeHue(smp.h);
  if (Math.abs(smp_h - std_h) > 180) {
    return std_h - (smp_h - 360 * Math.sign(smp_h - std_h));
  }
  return smp_h - std_h;
};
const differenceHueChroma = (std, smp) => {
  if (std.h === void 0 || smp.h === void 0 || !std.c || !smp.c) {
    return 0;
  }
  let std_h = normalizeHue(std.h);
  let smp_h = normalizeHue(smp.h);
  let dH = Math.sin((smp_h - std_h + 360) / 2 * Math.PI / 180);
  return 2 * Math.sqrt(std.c * smp.c) * dH;
};
const averageAngle = (val) => {
  let sum = val.reduce(
    (sum2, val2) => {
      if (val2 !== void 0) {
        let rad = val2 * Math.PI / 180;
        sum2.sin += Math.sin(rad);
        sum2.cos += Math.cos(rad);
      }
      return sum2;
    },
    { sin: 0, cos: 0 }
  );
  let angle = Math.atan2(sum.sin, sum.cos) * 180 / Math.PI;
  return angle < 0 ? 360 + angle : angle;
};
const definition$p = {
  mode: "cubehelix",
  channels: ["h", "s", "l", "alpha"],
  parse: ["--cubehelix"],
  serialize: "--cubehelix",
  ranges: {
    h: [0, 360],
    s: [0, 4.614],
    l: [0, 1]
  },
  fromMode: {
    rgb: convertRgbToCubehelix
  },
  toMode: {
    rgb: convertCubehelixToRgb
  },
  interpolate: {
    h: {
      use: interpolatorLinear,
      fixup: fixupHueShorter
    },
    s: interpolatorLinear,
    l: interpolatorLinear,
    alpha: {
      use: interpolatorLinear,
      fixup: fixupAlpha
    }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
};
const convertLabToLch = ({ l, a, b, alpha }, mode = "lch") => {
  if (a === void 0) a = 0;
  if (b === void 0) b = 0;
  let c2 = Math.sqrt(a * a + b * b);
  let res = { mode, l, c: c2 };
  if (c2) res.h = normalizeHue(Math.atan2(b, a) * 180 / Math.PI);
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const convertLchToLab = ({ l, c: c2, h, alpha }, mode = "lab") => {
  if (h === void 0) h = 0;
  let res = {
    mode,
    l,
    a: c2 ? c2 * Math.cos(h / 180 * Math.PI) : 0,
    b: c2 ? c2 * Math.sin(h / 180 * Math.PI) : 0
  };
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const k$1 = Math.pow(29, 3) / Math.pow(3, 3);
const e$1 = Math.pow(6, 3) / Math.pow(29, 3);
const D50 = {
  X: 0.3457 / 0.3585,
  Y: 1,
  Z: (1 - 0.3457 - 0.3585) / 0.3585
};
const D65 = {
  X: 0.3127 / 0.329,
  Y: 1,
  Z: (1 - 0.3127 - 0.329) / 0.329
};
let fn$1 = (v) => Math.pow(v, 3) > e$1 ? Math.pow(v, 3) : (116 * v - 16) / k$1;
const convertLab65ToXyz65 = ({ l, a, b, alpha }) => {
  if (l === void 0) l = 0;
  if (a === void 0) a = 0;
  if (b === void 0) b = 0;
  let fy = (l + 16) / 116;
  let fx = a / 500 + fy;
  let fz = fy - b / 200;
  let res = {
    mode: "xyz65",
    x: fn$1(fx) * D65.X,
    y: fn$1(fy) * D65.Y,
    z: fn$1(fz) * D65.Z
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertLab65ToRgb = (lab) => convertXyz65ToRgb(convertLab65ToXyz65(lab));
const f$1 = (value) => value > e$1 ? Math.cbrt(value) : (k$1 * value + 16) / 116;
const convertXyz65ToLab65 = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let f0 = f$1(x / D65.X);
  let f1 = f$1(y / D65.Y);
  let f2 = f$1(z / D65.Z);
  let res = {
    mode: "lab65",
    l: 116 * f1 - 16,
    a: 500 * (f0 - f1),
    b: 200 * (f1 - f2)
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertRgbToLab65 = (rgb2) => {
  let res = convertXyz65ToLab65(convertRgbToXyz65(rgb2));
  if (rgb2.r === rgb2.b && rgb2.b === rgb2.g) {
    res.a = res.b = 0;
  }
  return res;
};
const kE = 1;
const kCH = 1;
const θ = 26 / 180 * Math.PI;
const cosθ = Math.cos(θ);
const sinθ = Math.sin(θ);
const factor = 100 / Math.log(139 / 100);
const convertDlchToLab65 = ({ l, c: c2, h, alpha }) => {
  if (l === void 0) l = 0;
  if (c2 === void 0) c2 = 0;
  if (h === void 0) h = 0;
  let res = {
    mode: "lab65",
    l: (Math.exp(l * kE / factor) - 1) / 39e-4
  };
  let G = (Math.exp(0.0435 * c2 * kCH * kE) - 1) / 0.075;
  let e2 = G * Math.cos(h / 180 * Math.PI - θ);
  let f2 = G * Math.sin(h / 180 * Math.PI - θ);
  res.a = e2 * cosθ - f2 / 0.83 * sinθ;
  res.b = e2 * sinθ + f2 / 0.83 * cosθ;
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const convertLab65ToDlch = ({ l, a, b, alpha }) => {
  if (l === void 0) l = 0;
  if (a === void 0) a = 0;
  if (b === void 0) b = 0;
  let e2 = a * cosθ + b * sinθ;
  let f2 = 0.83 * (b * cosθ - a * sinθ);
  let G = Math.sqrt(e2 * e2 + f2 * f2);
  let res = {
    mode: "dlch",
    l: factor / kE * Math.log(1 + 39e-4 * l),
    c: Math.log(1 + 0.075 * G) / (0.0435 * kCH * kE)
  };
  if (res.c) {
    res.h = normalizeHue((Math.atan2(f2, e2) + θ) / Math.PI * 180);
  }
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const convertDlabToLab65 = (c2) => convertDlchToLab65(convertLabToLch(c2, "dlch"));
const convertLab65ToDlab = (c2) => convertLchToLab(convertLab65ToDlch(c2), "dlab");
const definition$o = {
  mode: "dlab",
  parse: ["--din99o-lab"],
  serialize: "--din99o-lab",
  toMode: {
    lab65: convertDlabToLab65,
    rgb: (c2) => convertLab65ToRgb(convertDlabToLab65(c2))
  },
  fromMode: {
    lab65: convertLab65ToDlab,
    rgb: (c2) => convertLab65ToDlab(convertRgbToLab65(c2))
  },
  channels: ["l", "a", "b", "alpha"],
  ranges: {
    l: [0, 100],
    a: [-40.09, 45.501],
    b: [-40.469, 44.344]
  },
  interpolate: {
    l: interpolatorLinear,
    a: interpolatorLinear,
    b: interpolatorLinear,
    alpha: {
      use: interpolatorLinear,
      fixup: fixupAlpha
    }
  }
};
const definition$n = {
  mode: "dlch",
  parse: ["--din99o-lch"],
  serialize: "--din99o-lch",
  toMode: {
    lab65: convertDlchToLab65,
    dlab: (c2) => convertLchToLab(c2, "dlab"),
    rgb: (c2) => convertLab65ToRgb(convertDlchToLab65(c2))
  },
  fromMode: {
    lab65: convertLab65ToDlch,
    dlab: (c2) => convertLabToLch(c2, "dlch"),
    rgb: (c2) => convertLab65ToDlch(convertRgbToLab65(c2))
  },
  channels: ["l", "c", "h", "alpha"],
  ranges: {
    l: [0, 100],
    c: [0, 51.484],
    h: [0, 360]
  },
  interpolate: {
    l: interpolatorLinear,
    c: interpolatorLinear,
    h: {
      use: interpolatorLinear,
      fixup: fixupHueShorter
    },
    alpha: {
      use: interpolatorLinear,
      fixup: fixupAlpha
    }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
};
function convertHsiToRgb({ h, s, i, alpha }) {
  h = normalizeHue(h !== void 0 ? h : 0);
  if (s === void 0) s = 0;
  if (i === void 0) i = 0;
  let f2 = Math.abs(h / 60 % 2 - 1);
  let res;
  switch (Math.floor(h / 60)) {
    case 0:
      res = {
        r: i * (1 + s * (3 / (2 - f2) - 1)),
        g: i * (1 + s * (3 * (1 - f2) / (2 - f2) - 1)),
        b: i * (1 - s)
      };
      break;
    case 1:
      res = {
        r: i * (1 + s * (3 * (1 - f2) / (2 - f2) - 1)),
        g: i * (1 + s * (3 / (2 - f2) - 1)),
        b: i * (1 - s)
      };
      break;
    case 2:
      res = {
        r: i * (1 - s),
        g: i * (1 + s * (3 / (2 - f2) - 1)),
        b: i * (1 + s * (3 * (1 - f2) / (2 - f2) - 1))
      };
      break;
    case 3:
      res = {
        r: i * (1 - s),
        g: i * (1 + s * (3 * (1 - f2) / (2 - f2) - 1)),
        b: i * (1 + s * (3 / (2 - f2) - 1))
      };
      break;
    case 4:
      res = {
        r: i * (1 + s * (3 * (1 - f2) / (2 - f2) - 1)),
        g: i * (1 - s),
        b: i * (1 + s * (3 / (2 - f2) - 1))
      };
      break;
    case 5:
      res = {
        r: i * (1 + s * (3 / (2 - f2) - 1)),
        g: i * (1 - s),
        b: i * (1 + s * (3 * (1 - f2) / (2 - f2) - 1))
      };
      break;
    default:
      res = { r: i * (1 - s), g: i * (1 - s), b: i * (1 - s) };
  }
  res.mode = "rgb";
  if (alpha !== void 0) res.alpha = alpha;
  return res;
}
function convertRgbToHsi({ r, g, b, alpha }) {
  if (r === void 0) r = 0;
  if (g === void 0) g = 0;
  if (b === void 0) b = 0;
  let M3 = Math.max(r, g, b), m = Math.min(r, g, b);
  let res = {
    mode: "hsi",
    s: r + g + b === 0 ? 0 : 1 - 3 * m / (r + g + b),
    i: (r + g + b) / 3
  };
  if (M3 - m !== 0)
    res.h = (M3 === r ? (g - b) / (M3 - m) + (g < b) * 6 : M3 === g ? (b - r) / (M3 - m) + 2 : (r - g) / (M3 - m) + 4) * 60;
  if (alpha !== void 0) res.alpha = alpha;
  return res;
}
const definition$m = {
  mode: "hsi",
  toMode: {
    rgb: convertHsiToRgb
  },
  parse: ["--hsi"],
  serialize: "--hsi",
  fromMode: {
    rgb: convertRgbToHsi
  },
  channels: ["h", "s", "i", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    s: interpolatorLinear,
    i: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
};
function convertHslToRgb({ h, s, l, alpha }) {
  h = normalizeHue(h !== void 0 ? h : 0);
  if (s === void 0) s = 0;
  if (l === void 0) l = 0;
  let m1 = l + s * (l < 0.5 ? l : 1 - l);
  let m2 = m1 - (m1 - l) * 2 * Math.abs(h / 60 % 2 - 1);
  let res;
  switch (Math.floor(h / 60)) {
    case 0:
      res = { r: m1, g: m2, b: 2 * l - m1 };
      break;
    case 1:
      res = { r: m2, g: m1, b: 2 * l - m1 };
      break;
    case 2:
      res = { r: 2 * l - m1, g: m1, b: m2 };
      break;
    case 3:
      res = { r: 2 * l - m1, g: m2, b: m1 };
      break;
    case 4:
      res = { r: m2, g: 2 * l - m1, b: m1 };
      break;
    case 5:
      res = { r: m1, g: 2 * l - m1, b: m2 };
      break;
    default:
      res = { r: 2 * l - m1, g: 2 * l - m1, b: 2 * l - m1 };
  }
  res.mode = "rgb";
  if (alpha !== void 0) res.alpha = alpha;
  return res;
}
function convertRgbToHsl({ r, g, b, alpha }) {
  if (r === void 0) r = 0;
  if (g === void 0) g = 0;
  if (b === void 0) b = 0;
  let M3 = Math.max(r, g, b), m = Math.min(r, g, b);
  let res = {
    mode: "hsl",
    s: M3 === m ? 0 : (M3 - m) / (1 - Math.abs(M3 + m - 1)),
    l: 0.5 * (M3 + m)
  };
  if (M3 - m !== 0)
    res.h = (M3 === r ? (g - b) / (M3 - m) + (g < b) * 6 : M3 === g ? (b - r) / (M3 - m) + 2 : (r - g) / (M3 - m) + 4) * 60;
  if (alpha !== void 0) res.alpha = alpha;
  return res;
}
const hueToDeg = (val, unit) => {
  switch (unit) {
    case "deg":
      return +val;
    case "rad":
      return val / Math.PI * 180;
    case "grad":
      return val / 10 * 9;
    case "turn":
      return val * 360;
  }
};
const hsl_old = new RegExp(
  `^hsla?\\(\\s*${hue$1}${c}${per}${c}${per}\\s*(?:,\\s*${num_per}\\s*)?\\)$`
);
const parseHslLegacy = (color) => {
  let match = color.match(hsl_old);
  if (!match) return;
  let res = { mode: "hsl" };
  if (match[3] !== void 0) {
    res.h = +match[3];
  } else if (match[1] !== void 0 && match[2] !== void 0) {
    res.h = hueToDeg(match[1], match[2]);
  }
  if (match[4] !== void 0) {
    res.s = Math.min(Math.max(0, match[4] / 100), 1);
  }
  if (match[5] !== void 0) {
    res.l = Math.min(Math.max(0, match[5] / 100), 1);
  }
  if (match[6] !== void 0) {
    res.alpha = Math.max(0, Math.min(1, match[6] / 100));
  } else if (match[7] !== void 0) {
    res.alpha = Math.max(0, Math.min(1, +match[7]));
  }
  return res;
};
function parseHsl(color, parsed) {
  if (!parsed || parsed[0] !== "hsl" && parsed[0] !== "hsla") {
    return void 0;
  }
  const res = { mode: "hsl" };
  const [, h, s, l, alpha] = parsed;
  if (h.type !== Tok.None) {
    if (h.type === Tok.Percentage) {
      return void 0;
    }
    res.h = h.value;
  }
  if (s.type !== Tok.None) {
    if (s.type === Tok.Hue) {
      return void 0;
    }
    res.s = s.value / 100;
  }
  if (l.type !== Tok.None) {
    if (l.type === Tok.Hue) {
      return void 0;
    }
    res.l = l.value / 100;
  }
  if (alpha.type !== Tok.None) {
    res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    );
  }
  return res;
}
const definition$l = {
  mode: "hsl",
  toMode: {
    rgb: convertHslToRgb
  },
  fromMode: {
    rgb: convertRgbToHsl
  },
  channels: ["h", "s", "l", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  parse: [parseHsl, parseHslLegacy],
  serialize: (c2) => `hsl(${c2.h !== void 0 ? c2.h : "none"} ${c2.s !== void 0 ? c2.s * 100 + "%" : "none"} ${c2.l !== void 0 ? c2.l * 100 + "%" : "none"}${c2.alpha < 1 ? ` / ${c2.alpha}` : ""})`,
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    s: interpolatorLinear,
    l: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
};
function convertHsvToRgb({ h, s, v, alpha }) {
  h = normalizeHue(h !== void 0 ? h : 0);
  if (s === void 0) s = 0;
  if (v === void 0) v = 0;
  let f2 = Math.abs(h / 60 % 2 - 1);
  let res;
  switch (Math.floor(h / 60)) {
    case 0:
      res = { r: v, g: v * (1 - s * f2), b: v * (1 - s) };
      break;
    case 1:
      res = { r: v * (1 - s * f2), g: v, b: v * (1 - s) };
      break;
    case 2:
      res = { r: v * (1 - s), g: v, b: v * (1 - s * f2) };
      break;
    case 3:
      res = { r: v * (1 - s), g: v * (1 - s * f2), b: v };
      break;
    case 4:
      res = { r: v * (1 - s * f2), g: v * (1 - s), b: v };
      break;
    case 5:
      res = { r: v, g: v * (1 - s), b: v * (1 - s * f2) };
      break;
    default:
      res = { r: v * (1 - s), g: v * (1 - s), b: v * (1 - s) };
  }
  res.mode = "rgb";
  if (alpha !== void 0) res.alpha = alpha;
  return res;
}
function convertRgbToHsv({ r, g, b, alpha }) {
  if (r === void 0) r = 0;
  if (g === void 0) g = 0;
  if (b === void 0) b = 0;
  let M3 = Math.max(r, g, b), m = Math.min(r, g, b);
  let res = {
    mode: "hsv",
    s: M3 === 0 ? 0 : 1 - m / M3,
    v: M3
  };
  if (M3 - m !== 0)
    res.h = (M3 === r ? (g - b) / (M3 - m) + (g < b) * 6 : M3 === g ? (b - r) / (M3 - m) + 2 : (r - g) / (M3 - m) + 4) * 60;
  if (alpha !== void 0) res.alpha = alpha;
  return res;
}
const definition$k = {
  mode: "hsv",
  toMode: {
    rgb: convertHsvToRgb
  },
  parse: ["--hsv"],
  serialize: "--hsv",
  fromMode: {
    rgb: convertRgbToHsv
  },
  channels: ["h", "s", "v", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    s: interpolatorLinear,
    v: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
};
function convertHwbToRgb({ h, w, b, alpha }) {
  if (w === void 0) w = 0;
  if (b === void 0) b = 0;
  if (w + b > 1) {
    let s = w + b;
    w /= s;
    b /= s;
  }
  return convertHsvToRgb({
    h,
    s: b === 1 ? 1 : 1 - w / (1 - b),
    v: 1 - b,
    alpha
  });
}
function convertRgbToHwb(rgba) {
  let hsv = convertRgbToHsv(rgba);
  if (hsv === void 0) return void 0;
  let s = hsv.s !== void 0 ? hsv.s : 0;
  let v = hsv.v !== void 0 ? hsv.v : 0;
  let res = {
    mode: "hwb",
    w: (1 - s) * v,
    b: 1 - v
  };
  if (hsv.h !== void 0) res.h = hsv.h;
  if (hsv.alpha !== void 0) res.alpha = hsv.alpha;
  return res;
}
function ParseHwb(color, parsed) {
  if (!parsed || parsed[0] !== "hwb") {
    return void 0;
  }
  const res = { mode: "hwb" };
  const [, h, w, b, alpha] = parsed;
  if (h.type !== Tok.None) {
    if (h.type === Tok.Percentage) {
      return void 0;
    }
    res.h = h.value;
  }
  if (w.type !== Tok.None) {
    if (w.type === Tok.Hue) {
      return void 0;
    }
    res.w = w.value / 100;
  }
  if (b.type !== Tok.None) {
    if (b.type === Tok.Hue) {
      return void 0;
    }
    res.b = b.value / 100;
  }
  if (alpha.type !== Tok.None) {
    res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    );
  }
  return res;
}
const definition$j = {
  mode: "hwb",
  toMode: {
    rgb: convertHwbToRgb
  },
  fromMode: {
    rgb: convertRgbToHwb
  },
  channels: ["h", "w", "b", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  parse: [ParseHwb],
  serialize: (c2) => `hwb(${c2.h !== void 0 ? c2.h : "none"} ${c2.w !== void 0 ? c2.w * 100 + "%" : "none"} ${c2.b !== void 0 ? c2.b * 100 + "%" : "none"}${c2.alpha < 1 ? ` / ${c2.alpha}` : ""})`,
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    w: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueNaive
  },
  average: {
    h: averageAngle
  }
};
const YW = 203;
const M1 = 0.1593017578125;
const M2 = 78.84375;
const C1 = 0.8359375;
const C2 = 18.8515625;
const C3 = 18.6875;
function transferPqDecode(v) {
  if (v < 0) return 0;
  const c2 = Math.pow(v, 1 / M2);
  return 1e4 * Math.pow(Math.max(0, c2 - C1) / (C2 - C3 * c2), 1 / M1);
}
function transferPqEncode(v) {
  if (v < 0) return 0;
  const c2 = Math.pow(v / 1e4, M1);
  return Math.pow((C1 + C2 * c2) / (1 + C3 * c2), M2);
}
const toRel = (c2) => Math.max(c2 / YW, 0);
const convertItpToXyz65 = ({ i, t, p: p2, alpha }) => {
  if (i === void 0) i = 0;
  if (t === void 0) t = 0;
  if (p2 === void 0) p2 = 0;
  const l = transferPqDecode(
    i + 0.008609037037932761 * t + 0.11102962500302593 * p2
  );
  const m = transferPqDecode(
    i - 0.00860903703793275 * t - 0.11102962500302599 * p2
  );
  const s = transferPqDecode(
    i + 0.5600313357106791 * t - 0.32062717498731885 * p2
  );
  const res = {
    mode: "xyz65",
    x: toRel(
      2.070152218389422 * l - 1.3263473389671556 * m + 0.2066510476294051 * s
    ),
    y: toRel(
      0.3647385209748074 * l + 0.680566024947227 * m - 0.0453045459220346 * s
    ),
    z: toRel(
      -0.049747207535812 * l - 0.0492609666966138 * m + 1.1880659249923042 * s
    )
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const toAbs = (c2 = 0) => Math.max(c2 * YW, 0);
const convertXyz65ToItp = ({ x, y, z, alpha }) => {
  const absX = toAbs(x);
  const absY = toAbs(y);
  const absZ = toAbs(z);
  const l = transferPqEncode(
    0.3592832590121217 * absX + 0.6976051147779502 * absY - 0.0358915932320289 * absZ
  );
  const m = transferPqEncode(
    -0.1920808463704995 * absX + 1.1004767970374323 * absY + 0.0753748658519118 * absZ
  );
  const s = transferPqEncode(
    0.0070797844607477 * absX + 0.0748396662186366 * absY + 0.8433265453898765 * absZ
  );
  const i = 0.5 * l + 0.5 * m;
  const t = 1.61376953125 * l - 3.323486328125 * m + 1.709716796875 * s;
  const p2 = 4.378173828125 * l - 4.24560546875 * m - 0.132568359375 * s;
  const res = { mode: "itp", i, t, p: p2 };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const definition$i = {
  mode: "itp",
  channels: ["i", "t", "p", "alpha"],
  parse: ["--ictcp"],
  serialize: "--ictcp",
  toMode: {
    xyz65: convertItpToXyz65,
    rgb: (color) => convertXyz65ToRgb(convertItpToXyz65(color))
  },
  fromMode: {
    xyz65: convertXyz65ToItp,
    rgb: (color) => convertXyz65ToItp(convertRgbToXyz65(color))
  },
  ranges: {
    i: [0, 0.581],
    t: [-0.369, 0.272],
    p: [-0.164, 0.331]
  },
  interpolate: {
    i: interpolatorLinear,
    t: interpolatorLinear,
    p: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const p$1 = 134.03437499999998;
const d0$1 = 16295499532821565e-27;
const jabPqEncode = (v) => {
  if (v < 0) return 0;
  let vn2 = Math.pow(v / 1e4, M1);
  return Math.pow((C1 + C2 * vn2) / (1 + C3 * vn2), p$1);
};
const abs = (v = 0) => Math.max(v * 203, 0);
const convertXyz65ToJab = ({ x, y, z, alpha }) => {
  x = abs(x);
  y = abs(y);
  z = abs(z);
  let xp = 1.15 * x - 0.15 * z;
  let yp = 0.66 * y + 0.34 * x;
  let l = jabPqEncode(0.41478972 * xp + 0.579999 * yp + 0.014648 * z);
  let m = jabPqEncode(-0.20151 * xp + 1.120649 * yp + 0.0531008 * z);
  let s = jabPqEncode(-0.0166008 * xp + 0.2648 * yp + 0.6684799 * z);
  let i = (l + m) / 2;
  let res = {
    mode: "jab",
    j: 0.44 * i / (1 - 0.56 * i) - d0$1,
    a: 3.524 * l - 4.066708 * m + 0.542708 * s,
    b: 0.199076 * l + 1.096799 * m - 1.295875 * s
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const p = 134.03437499999998;
const d0 = 16295499532821565e-27;
const jabPqDecode = (v) => {
  if (v < 0) return 0;
  let vp = Math.pow(v, 1 / p);
  return 1e4 * Math.pow((C1 - vp) / (C3 * vp - C2), 1 / M1);
};
const rel = (v) => v / 203;
const convertJabToXyz65 = ({ j, a, b, alpha }) => {
  if (j === void 0) j = 0;
  if (a === void 0) a = 0;
  if (b === void 0) b = 0;
  let i = (j + d0) / (0.44 + 0.56 * (j + d0));
  let l = jabPqDecode(i + 0.13860504 * a + 0.058047316 * b);
  let m = jabPqDecode(i - 0.13860504 * a - 0.058047316 * b);
  let s = jabPqDecode(i - 0.096019242 * a - 0.8118919 * b);
  let res = {
    mode: "xyz65",
    x: rel(
      1.661373024652174 * l - 0.914523081304348 * m + 0.23136208173913045 * s
    ),
    y: rel(
      -0.3250758611844533 * l + 1.571847026732543 * m - 0.21825383453227928 * s
    ),
    z: rel(-0.090982811 * l - 0.31272829 * m + 1.5227666 * s)
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertRgbToJab = (rgb2) => {
  let res = convertXyz65ToJab(convertRgbToXyz65(rgb2));
  if (rgb2.r === rgb2.b && rgb2.b === rgb2.g) {
    res.a = res.b = 0;
  }
  return res;
};
const convertJabToRgb = (color) => convertXyz65ToRgb(convertJabToXyz65(color));
const definition$h = {
  mode: "jab",
  channels: ["j", "a", "b", "alpha"],
  parse: ["--jzazbz"],
  serialize: "--jzazbz",
  fromMode: {
    rgb: convertRgbToJab,
    xyz65: convertXyz65ToJab
  },
  toMode: {
    rgb: convertJabToRgb,
    xyz65: convertJabToXyz65
  },
  ranges: {
    j: [0, 0.222],
    a: [-0.109, 0.129],
    b: [-0.185, 0.134]
  },
  interpolate: {
    j: interpolatorLinear,
    a: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const convertJabToJch = ({ j, a, b, alpha }) => {
  if (a === void 0) a = 0;
  if (b === void 0) b = 0;
  let c2 = Math.sqrt(a * a + b * b);
  let res = {
    mode: "jch",
    j,
    c: c2
  };
  if (c2) {
    res.h = normalizeHue(Math.atan2(b, a) * 180 / Math.PI);
  }
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertJchToJab = ({ j, c: c2, h, alpha }) => {
  if (h === void 0) h = 0;
  let res = {
    mode: "jab",
    j,
    a: c2 ? c2 * Math.cos(h / 180 * Math.PI) : 0,
    b: c2 ? c2 * Math.sin(h / 180 * Math.PI) : 0
  };
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const definition$g = {
  mode: "jch",
  parse: ["--jzczhz"],
  serialize: "--jzczhz",
  toMode: {
    jab: convertJchToJab,
    rgb: (c2) => convertJabToRgb(convertJchToJab(c2))
  },
  fromMode: {
    rgb: (c2) => convertJabToJch(convertRgbToJab(c2)),
    jab: convertJabToJch
  },
  channels: ["j", "c", "h", "alpha"],
  ranges: {
    j: [0, 0.221],
    c: [0, 0.19],
    h: [0, 360]
  },
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    c: interpolatorLinear,
    j: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
};
const k = Math.pow(29, 3) / Math.pow(3, 3);
const e = Math.pow(6, 3) / Math.pow(29, 3);
let fn = (v) => Math.pow(v, 3) > e ? Math.pow(v, 3) : (116 * v - 16) / k;
const convertLabToXyz50 = ({ l, a, b, alpha }) => {
  if (l === void 0) l = 0;
  if (a === void 0) a = 0;
  if (b === void 0) b = 0;
  let fy = (l + 16) / 116;
  let fx = a / 500 + fy;
  let fz = fy - b / 200;
  let res = {
    mode: "xyz50",
    x: fn(fx) * D50.X,
    y: fn(fy) * D50.Y,
    z: fn(fz) * D50.Z
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertXyz50ToRgb = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = convertLrgbToRgb({
    r: x * 3.1341359569958707 - y * 1.6173863321612538 - 0.4906619460083532 * z,
    g: x * -0.978795502912089 + y * 1.916254567259524 + 0.03344273116131949 * z,
    b: x * 0.07195537988411677 - y * 0.2289768264158322 + 1.405386058324125 * z
  });
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertLabToRgb = (lab) => convertXyz50ToRgb(convertLabToXyz50(lab));
const convertRgbToXyz50 = (rgb2) => {
  let { r, g, b, alpha } = convertRgbToLrgb(rgb2);
  let res = {
    mode: "xyz50",
    x: 0.436065742824811 * r + 0.3851514688337912 * g + 0.14307845442264197 * b,
    y: 0.22249319175623702 * r + 0.7168870538238823 * g + 0.06061979053616537 * b,
    z: 0.013923904500943465 * r + 0.09708128566574634 * g + 0.7140993584005155 * b
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const f = (value) => value > e ? Math.cbrt(value) : (k * value + 16) / 116;
const convertXyz50ToLab = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let f0 = f(x / D50.X);
  let f1 = f(y / D50.Y);
  let f2 = f(z / D50.Z);
  let res = {
    mode: "lab",
    l: 116 * f1 - 16,
    a: 500 * (f0 - f1),
    b: 200 * (f1 - f2)
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertRgbToLab = (rgb2) => {
  let res = convertXyz50ToLab(convertRgbToXyz50(rgb2));
  if (rgb2.r === rgb2.b && rgb2.b === rgb2.g) {
    res.a = res.b = 0;
  }
  return res;
};
function parseLab(color, parsed) {
  if (!parsed || parsed[0] !== "lab") {
    return void 0;
  }
  const res = { mode: "lab" };
  const [, l, a, b, alpha] = parsed;
  if (l.type === Tok.Hue || a.type === Tok.Hue || b.type === Tok.Hue) {
    return void 0;
  }
  if (l.type !== Tok.None) {
    res.l = Math.min(Math.max(0, l.value), 100);
  }
  if (a.type !== Tok.None) {
    res.a = a.type === Tok.Number ? a.value : a.value * 125 / 100;
  }
  if (b.type !== Tok.None) {
    res.b = b.type === Tok.Number ? b.value : b.value * 125 / 100;
  }
  if (alpha.type !== Tok.None) {
    res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    );
  }
  return res;
}
const definition$f = {
  mode: "lab",
  toMode: {
    xyz50: convertLabToXyz50,
    rgb: convertLabToRgb
  },
  fromMode: {
    xyz50: convertXyz50ToLab,
    rgb: convertRgbToLab
  },
  channels: ["l", "a", "b", "alpha"],
  ranges: {
    l: [0, 100],
    a: [-125, 125],
    b: [-125, 125]
  },
  parse: [parseLab],
  serialize: (c2) => `lab(${c2.l !== void 0 ? c2.l : "none"} ${c2.a !== void 0 ? c2.a : "none"} ${c2.b !== void 0 ? c2.b : "none"}${c2.alpha < 1 ? ` / ${c2.alpha}` : ""})`,
  interpolate: {
    l: interpolatorLinear,
    a: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const definition$e = {
  ...definition$f,
  mode: "lab65",
  parse: ["--lab-d65"],
  serialize: "--lab-d65",
  toMode: {
    xyz65: convertLab65ToXyz65,
    rgb: convertLab65ToRgb
  },
  fromMode: {
    xyz65: convertXyz65ToLab65,
    rgb: convertRgbToLab65
  },
  ranges: {
    l: [0, 100],
    a: [-125, 125],
    b: [-125, 125]
  }
};
function parseLch(color, parsed) {
  if (!parsed || parsed[0] !== "lch") {
    return void 0;
  }
  const res = { mode: "lch" };
  const [, l, c2, h, alpha] = parsed;
  if (l.type !== Tok.None) {
    if (l.type === Tok.Hue) {
      return void 0;
    }
    res.l = Math.min(Math.max(0, l.value), 100);
  }
  if (c2.type !== Tok.None) {
    res.c = Math.max(
      0,
      c2.type === Tok.Number ? c2.value : c2.value * 150 / 100
    );
  }
  if (h.type !== Tok.None) {
    if (h.type === Tok.Percentage) {
      return void 0;
    }
    res.h = h.value;
  }
  if (alpha.type !== Tok.None) {
    res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    );
  }
  return res;
}
const definition$d = {
  mode: "lch",
  toMode: {
    lab: convertLchToLab,
    rgb: (c2) => convertLabToRgb(convertLchToLab(c2))
  },
  fromMode: {
    rgb: (c2) => convertLabToLch(convertRgbToLab(c2)),
    lab: convertLabToLch
  },
  channels: ["l", "c", "h", "alpha"],
  ranges: {
    l: [0, 100],
    c: [0, 150],
    h: [0, 360]
  },
  parse: [parseLch],
  serialize: (c2) => `lch(${c2.l !== void 0 ? c2.l : "none"} ${c2.c !== void 0 ? c2.c : "none"} ${c2.h !== void 0 ? c2.h : "none"}${c2.alpha < 1 ? ` / ${c2.alpha}` : ""})`,
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    c: interpolatorLinear,
    l: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
};
const definition$c = {
  ...definition$d,
  mode: "lch65",
  parse: ["--lch-d65"],
  serialize: "--lch-d65",
  toMode: {
    lab65: (c2) => convertLchToLab(c2, "lab65"),
    rgb: (c2) => convertLab65ToRgb(convertLchToLab(c2, "lab65"))
  },
  fromMode: {
    rgb: (c2) => convertLabToLch(convertRgbToLab65(c2), "lch65"),
    lab65: (c2) => convertLabToLch(c2, "lch65")
  },
  ranges: {
    l: [0, 100],
    c: [0, 150],
    h: [0, 360]
  }
};
const convertLuvToLchuv = ({ l, u, v, alpha }) => {
  if (u === void 0) u = 0;
  if (v === void 0) v = 0;
  let c2 = Math.sqrt(u * u + v * v);
  let res = {
    mode: "lchuv",
    l,
    c: c2
  };
  if (c2) {
    res.h = normalizeHue(Math.atan2(v, u) * 180 / Math.PI);
  }
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertLchuvToLuv = ({ l, c: c2, h, alpha }) => {
  if (h === void 0) h = 0;
  let res = {
    mode: "luv",
    l,
    u: c2 ? c2 * Math.cos(h / 180 * Math.PI) : 0,
    v: c2 ? c2 * Math.sin(h / 180 * Math.PI) : 0
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const u_fn$1 = (x, y, z) => 4 * x / (x + 15 * y + 3 * z);
const v_fn$1 = (x, y, z) => 9 * y / (x + 15 * y + 3 * z);
const un$1 = u_fn$1(D50.X, D50.Y, D50.Z);
const vn$1 = v_fn$1(D50.X, D50.Y, D50.Z);
const l_fn = (value) => value <= e ? k * value : 116 * Math.cbrt(value) - 16;
const convertXyz50ToLuv = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let l = l_fn(y / D50.Y);
  let u = u_fn$1(x, y, z);
  let v = v_fn$1(x, y, z);
  if (!isFinite(u) || !isFinite(v)) {
    l = u = v = 0;
  } else {
    u = 13 * l * (u - un$1);
    v = 13 * l * (v - vn$1);
  }
  let res = {
    mode: "luv",
    l,
    u,
    v
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const u_fn = (x, y, z) => 4 * x / (x + 15 * y + 3 * z);
const v_fn = (x, y, z) => 9 * y / (x + 15 * y + 3 * z);
const un = u_fn(D50.X, D50.Y, D50.Z);
const vn = v_fn(D50.X, D50.Y, D50.Z);
const convertLuvToXyz50 = ({ l, u, v, alpha }) => {
  if (l === void 0) l = 0;
  if (l === 0) {
    return { mode: "xyz50", x: 0, y: 0, z: 0 };
  }
  if (u === void 0) u = 0;
  if (v === void 0) v = 0;
  let up = u / (13 * l) + un;
  let vp = v / (13 * l) + vn;
  let y = D50.Y * (l <= 8 ? l / k : Math.pow((l + 16) / 116, 3));
  let x = y * (9 * up) / (4 * vp);
  let z = y * (12 - 3 * up - 20 * vp) / (4 * vp);
  let res = { mode: "xyz50", x, y, z };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertRgbToLchuv = (rgb2) => convertLuvToLchuv(convertXyz50ToLuv(convertRgbToXyz50(rgb2)));
const convertLchuvToRgb = (lchuv) => convertXyz50ToRgb(convertLuvToXyz50(convertLchuvToLuv(lchuv)));
const definition$b = {
  mode: "lchuv",
  toMode: {
    luv: convertLchuvToLuv,
    rgb: convertLchuvToRgb
  },
  fromMode: {
    rgb: convertRgbToLchuv,
    luv: convertLuvToLchuv
  },
  channels: ["l", "c", "h", "alpha"],
  parse: ["--lchuv"],
  serialize: "--lchuv",
  ranges: {
    l: [0, 100],
    c: [0, 176.956],
    h: [0, 360]
  },
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    c: interpolatorLinear,
    l: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
};
const definition$a = {
  ...definition$r,
  mode: "lrgb",
  toMode: {
    rgb: convertLrgbToRgb
  },
  fromMode: {
    rgb: convertRgbToLrgb
  },
  parse: ["srgb-linear"],
  serialize: "srgb-linear"
};
const definition$9 = {
  mode: "luv",
  toMode: {
    xyz50: convertLuvToXyz50,
    rgb: (luv) => convertXyz50ToRgb(convertLuvToXyz50(luv))
  },
  fromMode: {
    xyz50: convertXyz50ToLuv,
    rgb: (rgb2) => convertXyz50ToLuv(convertRgbToXyz50(rgb2))
  },
  channels: ["l", "u", "v", "alpha"],
  parse: ["--luv"],
  serialize: "--luv",
  ranges: {
    l: [0, 100],
    u: [-84.936, 175.042],
    v: [-125.882, 87.243]
  },
  interpolate: {
    l: interpolatorLinear,
    u: interpolatorLinear,
    v: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const convertLrgbToOklab = ({ r, g, b, alpha }) => {
  if (r === void 0) r = 0;
  if (g === void 0) g = 0;
  if (b === void 0) b = 0;
  let L = Math.cbrt(
    0.412221469470763 * r + 0.5363325372617348 * g + 0.0514459932675022 * b
  );
  let M3 = Math.cbrt(
    0.2119034958178252 * r + 0.6806995506452344 * g + 0.1073969535369406 * b
  );
  let S = Math.cbrt(
    0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738222 * b
  );
  let res = {
    mode: "oklab",
    l: 0.210454268309314 * L + 0.7936177747023054 * M3 - 0.0040720430116193 * S,
    a: 1.9779985324311684 * L - 2.42859224204858 * M3 + 0.450593709617411 * S,
    b: 0.0259040424655478 * L + 0.7827717124575296 * M3 - 0.8086757549230774 * S
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertRgbToOklab = (rgb2) => {
  let res = convertLrgbToOklab(convertRgbToLrgb(rgb2));
  if (rgb2.r === rgb2.b && rgb2.b === rgb2.g) {
    res.a = res.b = 0;
  }
  return res;
};
const convertOklabToLrgb = ({ l, a, b, alpha }) => {
  if (l === void 0) l = 0;
  if (a === void 0) a = 0;
  if (b === void 0) b = 0;
  let L = Math.pow(l + 0.3963377773761749 * a + 0.2158037573099136 * b, 3);
  let M3 = Math.pow(l - 0.1055613458156586 * a - 0.0638541728258133 * b, 3);
  let S = Math.pow(l - 0.0894841775298119 * a - 1.2914855480194092 * b, 3);
  let res = {
    mode: "lrgb",
    r: 4.076741636075957 * L - 3.3077115392580616 * M3 + 0.2309699031821044 * S,
    g: -1.2684379732850317 * L + 2.6097573492876887 * M3 - 0.3413193760026573 * S,
    b: -0.0041960761386756 * L - 0.7034186179359362 * M3 + 1.7076146940746117 * S
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertOklabToRgb = (c2) => convertLrgbToRgb(convertOklabToLrgb(c2));
function toe(x) {
  const k_1 = 0.206;
  const k_2 = 0.03;
  const k_3 = (1 + k_1) / (1 + k_2);
  return 0.5 * (k_3 * x - k_1 + Math.sqrt((k_3 * x - k_1) * (k_3 * x - k_1) + 4 * k_2 * k_3 * x));
}
function toe_inv(x) {
  const k_1 = 0.206;
  const k_2 = 0.03;
  const k_3 = (1 + k_1) / (1 + k_2);
  return (x * x + k_1 * x) / (k_3 * (x + k_2));
}
function compute_max_saturation(a, b) {
  let k0, k1, k2, k3, k4, wl, wm, ws;
  if (-1.88170328 * a - 0.80936493 * b > 1) {
    k0 = 1.19086277;
    k1 = 1.76576728;
    k2 = 0.59662641;
    k3 = 0.75515197;
    k4 = 0.56771245;
    wl = 4.0767416621;
    wm = -3.3077115913;
    ws = 0.2309699292;
  } else if (1.81444104 * a - 1.19445276 * b > 1) {
    k0 = 0.73956515;
    k1 = -0.45954404;
    k2 = 0.08285427;
    k3 = 0.1254107;
    k4 = 0.14503204;
    wl = -1.2684380046;
    wm = 2.6097574011;
    ws = -0.3413193965;
  } else {
    k0 = 1.35733652;
    k1 = -915799e-8;
    k2 = -1.1513021;
    k3 = -0.50559606;
    k4 = 692167e-8;
    wl = -0.0041960863;
    wm = -0.7034186147;
    ws = 1.707614701;
  }
  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;
  let k_l = 0.3963377774 * a + 0.2158037573 * b;
  let k_m = -0.1055613458 * a - 0.0638541728 * b;
  let k_s = -0.0894841775 * a - 1.291485548 * b;
  {
    let l_ = 1 + S * k_l;
    let m_ = 1 + S * k_m;
    let s_ = 1 + S * k_s;
    let l = l_ * l_ * l_;
    let m = m_ * m_ * m_;
    let s = s_ * s_ * s_;
    let l_dS = 3 * k_l * l_ * l_;
    let m_dS = 3 * k_m * m_ * m_;
    let s_dS = 3 * k_s * s_ * s_;
    let l_dS2 = 6 * k_l * k_l * l_;
    let m_dS2 = 6 * k_m * k_m * m_;
    let s_dS2 = 6 * k_s * k_s * s_;
    let f2 = wl * l + wm * m + ws * s;
    let f1 = wl * l_dS + wm * m_dS + ws * s_dS;
    let f22 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;
    S = S - f2 * f1 / (f1 * f1 - 0.5 * f2 * f22);
  }
  return S;
}
function find_cusp(a, b) {
  let S_cusp = compute_max_saturation(a, b);
  let rgb2 = convertOklabToLrgb({ l: 1, a: S_cusp * a, b: S_cusp * b });
  let L_cusp = Math.cbrt(1 / Math.max(rgb2.r, rgb2.g, rgb2.b));
  let C_cusp = L_cusp * S_cusp;
  return [L_cusp, C_cusp];
}
function find_gamut_intersection(a, b, L1, C12, L0, cusp = null) {
  if (!cusp) {
    cusp = find_cusp(a, b);
  }
  let t;
  if ((L1 - L0) * cusp[1] - (cusp[0] - L0) * C12 <= 0) {
    t = cusp[1] * L0 / (C12 * cusp[0] + cusp[1] * (L0 - L1));
  } else {
    t = cusp[1] * (L0 - 1) / (C12 * (cusp[0] - 1) + cusp[1] * (L0 - L1));
    {
      let dL = L1 - L0;
      let dC = C12;
      let k_l = 0.3963377774 * a + 0.2158037573 * b;
      let k_m = -0.1055613458 * a - 0.0638541728 * b;
      let k_s = -0.0894841775 * a - 1.291485548 * b;
      let l_dt = dL + dC * k_l;
      let m_dt = dL + dC * k_m;
      let s_dt = dL + dC * k_s;
      {
        let L = L0 * (1 - t) + t * L1;
        let C = t * C12;
        let l_ = L + C * k_l;
        let m_ = L + C * k_m;
        let s_ = L + C * k_s;
        let l = l_ * l_ * l_;
        let m = m_ * m_ * m_;
        let s = s_ * s_ * s_;
        let ldt = 3 * l_dt * l_ * l_;
        let mdt = 3 * m_dt * m_ * m_;
        let sdt = 3 * s_dt * s_ * s_;
        let ldt2 = 6 * l_dt * l_dt * l_;
        let mdt2 = 6 * m_dt * m_dt * m_;
        let sdt2 = 6 * s_dt * s_dt * s_;
        let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s - 1;
        let r1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
        let r2 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;
        let u_r = r1 / (r1 * r1 - 0.5 * r * r2);
        let t_r = -r * u_r;
        let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s - 1;
        let g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
        let g2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;
        let u_g = g1 / (g1 * g1 - 0.5 * g * g2);
        let t_g = -g * u_g;
        let b2 = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s - 1;
        let b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.707614701 * sdt;
        let b22 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.707614701 * sdt2;
        let u_b = b1 / (b1 * b1 - 0.5 * b2 * b22);
        let t_b = -b2 * u_b;
        t_r = u_r >= 0 ? t_r : 1e6;
        t_g = u_g >= 0 ? t_g : 1e6;
        t_b = u_b >= 0 ? t_b : 1e6;
        t += Math.min(t_r, Math.min(t_g, t_b));
      }
    }
  }
  return t;
}
function get_ST_max(a_, b_, cusp = null) {
  if (!cusp) {
    cusp = find_cusp(a_, b_);
  }
  let L = cusp[0];
  let C = cusp[1];
  return [C / L, C / (1 - L)];
}
function get_Cs(L, a_, b_) {
  let cusp = find_cusp(a_, b_);
  let C_max = find_gamut_intersection(a_, b_, L, 1, L, cusp);
  let ST_max = get_ST_max(a_, b_, cusp);
  let S_mid = 0.11516993 + 1 / (7.4477897 + 4.1590124 * b_ + a_ * (-2.19557347 + 1.75198401 * b_ + a_ * (-2.13704948 - 10.02301043 * b_ + a_ * (-4.24894561 + 5.38770819 * b_ + 4.69891013 * a_))));
  let T_mid = 0.11239642 + 1 / (1.6132032 - 0.68124379 * b_ + a_ * (0.40370612 + 0.90148123 * b_ + a_ * (-0.27087943 + 0.6122399 * b_ + a_ * (299215e-8 - 0.45399568 * b_ - 0.14661872 * a_))));
  let k2 = C_max / Math.min(L * ST_max[0], (1 - L) * ST_max[1]);
  let C_a = L * S_mid;
  let C_b = (1 - L) * T_mid;
  let C_mid = 0.9 * k2 * Math.sqrt(
    Math.sqrt(
      1 / (1 / (C_a * C_a * C_a * C_a) + 1 / (C_b * C_b * C_b * C_b))
    )
  );
  C_a = L * 0.4;
  C_b = (1 - L) * 0.8;
  let C_0 = Math.sqrt(1 / (1 / (C_a * C_a) + 1 / (C_b * C_b)));
  return [C_0, C_mid, C_max];
}
function convertOklabToOkhsl(lab) {
  const l = lab.l !== void 0 ? lab.l : 0;
  const a = lab.a !== void 0 ? lab.a : 0;
  const b = lab.b !== void 0 ? lab.b : 0;
  const ret = { mode: "okhsl", l: toe(l) };
  if (lab.alpha !== void 0) {
    ret.alpha = lab.alpha;
  }
  let c2 = Math.sqrt(a * a + b * b);
  if (!c2) {
    ret.s = 0;
    return ret;
  }
  let [C_0, C_mid, C_max] = get_Cs(l, a / c2, b / c2);
  let s;
  if (c2 < C_mid) {
    let k_0 = 0;
    let k_1 = 0.8 * C_0;
    let k_2 = 1 - k_1 / C_mid;
    let t = (c2 - k_0) / (k_1 + k_2 * (c2 - k_0));
    s = t * 0.8;
  } else {
    let k_0 = C_mid;
    let k_1 = 0.2 * C_mid * C_mid * 1.25 * 1.25 / C_0;
    let k_2 = 1 - k_1 / (C_max - C_mid);
    let t = (c2 - k_0) / (k_1 + k_2 * (c2 - k_0));
    s = 0.8 + 0.2 * t;
  }
  if (s) {
    ret.s = s;
    ret.h = normalizeHue(Math.atan2(b, a) * 180 / Math.PI);
  }
  return ret;
}
function convertOkhslToOklab(hsl) {
  let h = hsl.h !== void 0 ? hsl.h : 0;
  let s = hsl.s !== void 0 ? hsl.s : 0;
  let l = hsl.l !== void 0 ? hsl.l : 0;
  const ret = { mode: "oklab", l: toe_inv(l) };
  if (hsl.alpha !== void 0) {
    ret.alpha = hsl.alpha;
  }
  if (!s || l === 1) {
    ret.a = ret.b = 0;
    return ret;
  }
  let a_ = Math.cos(h / 180 * Math.PI);
  let b_ = Math.sin(h / 180 * Math.PI);
  let [C_0, C_mid, C_max] = get_Cs(ret.l, a_, b_);
  let t, k_0, k_1, k_2;
  if (s < 0.8) {
    t = 1.25 * s;
    k_0 = 0;
    k_1 = 0.8 * C_0;
    k_2 = 1 - k_1 / C_mid;
  } else {
    t = 5 * (s - 0.8);
    k_0 = C_mid;
    k_1 = 0.2 * C_mid * C_mid * 1.25 * 1.25 / C_0;
    k_2 = 1 - k_1 / (C_max - C_mid);
  }
  let C = k_0 + t * k_1 / (1 - k_2 * t);
  ret.a = C * a_;
  ret.b = C * b_;
  return ret;
}
const modeOkhsl = {
  ...definition$l,
  mode: "okhsl",
  channels: ["h", "s", "l", "alpha"],
  parse: ["--okhsl"],
  serialize: "--okhsl",
  fromMode: {
    oklab: convertOklabToOkhsl,
    rgb: (c2) => convertOklabToOkhsl(convertRgbToOklab(c2))
  },
  toMode: {
    oklab: convertOkhslToOklab,
    rgb: (c2) => convertOklabToRgb(convertOkhslToOklab(c2))
  }
};
function convertOklabToOkhsv(lab) {
  let l = lab.l !== void 0 ? lab.l : 0;
  let a = lab.a !== void 0 ? lab.a : 0;
  let b = lab.b !== void 0 ? lab.b : 0;
  let c2 = Math.sqrt(a * a + b * b);
  let a_ = c2 ? a / c2 : 1;
  let b_ = c2 ? b / c2 : 1;
  let [S_max, T] = get_ST_max(a_, b_);
  let S_0 = 0.5;
  let k2 = 1 - S_0 / S_max;
  let t = T / (c2 + l * T);
  let L_v = t * l;
  let C_v = t * c2;
  let L_vt = toe_inv(L_v);
  let C_vt = C_v * L_vt / L_v;
  let rgb_scale = convertOklabToLrgb({ l: L_vt, a: a_ * C_vt, b: b_ * C_vt });
  let scale_L = Math.cbrt(
    1 / Math.max(rgb_scale.r, rgb_scale.g, rgb_scale.b, 0)
  );
  l = l / scale_L;
  c2 = c2 / scale_L * toe(l) / l;
  l = toe(l);
  const ret = {
    mode: "okhsv",
    s: c2 ? (S_0 + T) * C_v / (T * S_0 + T * k2 * C_v) : 0,
    v: l ? l / L_v : 0
  };
  if (ret.s) {
    ret.h = normalizeHue(Math.atan2(b, a) * 180 / Math.PI);
  }
  if (lab.alpha !== void 0) {
    ret.alpha = lab.alpha;
  }
  return ret;
}
function convertOkhsvToOklab(hsv) {
  const ret = { mode: "oklab" };
  if (hsv.alpha !== void 0) {
    ret.alpha = hsv.alpha;
  }
  const h = hsv.h !== void 0 ? hsv.h : 0;
  const s = hsv.s !== void 0 ? hsv.s : 0;
  const v = hsv.v !== void 0 ? hsv.v : 0;
  const a_ = Math.cos(h / 180 * Math.PI);
  const b_ = Math.sin(h / 180 * Math.PI);
  const [S_max, T] = get_ST_max(a_, b_);
  const S_0 = 0.5;
  const k2 = 1 - S_0 / S_max;
  const L_v = 1 - s * S_0 / (S_0 + T - T * k2 * s);
  const C_v = s * T * S_0 / (S_0 + T - T * k2 * s);
  const L_vt = toe_inv(L_v);
  const C_vt = C_v * L_vt / L_v;
  const rgb_scale = convertOklabToLrgb({
    l: L_vt,
    a: a_ * C_vt,
    b: b_ * C_vt
  });
  const scale_L = Math.cbrt(
    1 / Math.max(rgb_scale.r, rgb_scale.g, rgb_scale.b, 0)
  );
  const L_new = toe_inv(v * L_v);
  const C = C_v * L_new / L_v;
  ret.l = L_new * scale_L;
  ret.a = C * a_ * scale_L;
  ret.b = C * b_ * scale_L;
  return ret;
}
const modeOkhsv = {
  ...definition$k,
  mode: "okhsv",
  channels: ["h", "s", "v", "alpha"],
  parse: ["--okhsv"],
  serialize: "--okhsv",
  fromMode: {
    oklab: convertOklabToOkhsv,
    rgb: (c2) => convertOklabToOkhsv(convertRgbToOklab(c2))
  },
  toMode: {
    oklab: convertOkhsvToOklab,
    rgb: (c2) => convertOklabToRgb(convertOkhsvToOklab(c2))
  }
};
function parseOklab(color, parsed) {
  if (!parsed || parsed[0] !== "oklab") {
    return void 0;
  }
  const res = { mode: "oklab" };
  const [, l, a, b, alpha] = parsed;
  if (l.type === Tok.Hue || a.type === Tok.Hue || b.type === Tok.Hue) {
    return void 0;
  }
  if (l.type !== Tok.None) {
    res.l = Math.min(
      Math.max(0, l.type === Tok.Number ? l.value : l.value / 100),
      1
    );
  }
  if (a.type !== Tok.None) {
    res.a = a.type === Tok.Number ? a.value : a.value * 0.4 / 100;
  }
  if (b.type !== Tok.None) {
    res.b = b.type === Tok.Number ? b.value : b.value * 0.4 / 100;
  }
  if (alpha.type !== Tok.None) {
    res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    );
  }
  return res;
}
const definition$8 = {
  ...definition$f,
  mode: "oklab",
  toMode: {
    lrgb: convertOklabToLrgb,
    rgb: convertOklabToRgb
  },
  fromMode: {
    lrgb: convertLrgbToOklab,
    rgb: convertRgbToOklab
  },
  ranges: {
    l: [0, 1],
    a: [-0.4, 0.4],
    b: [-0.4, 0.4]
  },
  parse: [parseOklab],
  serialize: (c2) => `oklab(${c2.l !== void 0 ? c2.l : "none"} ${c2.a !== void 0 ? c2.a : "none"} ${c2.b !== void 0 ? c2.b : "none"}${c2.alpha < 1 ? ` / ${c2.alpha}` : ""})`
};
function parseOklch(color, parsed) {
  if (!parsed || parsed[0] !== "oklch") {
    return void 0;
  }
  const res = { mode: "oklch" };
  const [, l, c2, h, alpha] = parsed;
  if (l.type !== Tok.None) {
    if (l.type === Tok.Hue) {
      return void 0;
    }
    res.l = Math.min(
      Math.max(0, l.type === Tok.Number ? l.value : l.value / 100),
      1
    );
  }
  if (c2.type !== Tok.None) {
    res.c = Math.max(
      0,
      c2.type === Tok.Number ? c2.value : c2.value * 0.4 / 100
    );
  }
  if (h.type !== Tok.None) {
    if (h.type === Tok.Percentage) {
      return void 0;
    }
    res.h = h.value;
  }
  if (alpha.type !== Tok.None) {
    res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    );
  }
  return res;
}
const definition$7 = {
  ...definition$d,
  mode: "oklch",
  toMode: {
    oklab: (c2) => convertLchToLab(c2, "oklab"),
    rgb: (c2) => convertOklabToRgb(convertLchToLab(c2, "oklab"))
  },
  fromMode: {
    rgb: (c2) => convertLabToLch(convertRgbToOklab(c2), "oklch"),
    oklab: (c2) => convertLabToLch(c2, "oklch")
  },
  parse: [parseOklch],
  serialize: (c2) => `oklch(${c2.l !== void 0 ? c2.l : "none"} ${c2.c !== void 0 ? c2.c : "none"} ${c2.h !== void 0 ? c2.h : "none"}${c2.alpha < 1 ? ` / ${c2.alpha}` : ""})`,
  ranges: {
    l: [0, 1],
    c: [0, 0.4],
    h: [0, 360]
  }
};
const convertP3ToXyz65 = (rgb2) => {
  let { r, g, b, alpha } = convertRgbToLrgb(rgb2);
  let res = {
    mode: "xyz65",
    x: 0.486570948648216 * r + 0.265667693169093 * g + 0.1982172852343625 * b,
    y: 0.2289745640697487 * r + 0.6917385218365062 * g + 0.079286914093745 * b,
    z: 0 * r + 0.0451133818589026 * g + 1.043944368900976 * b
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertXyz65ToP3 = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = convertLrgbToRgb(
    {
      r: x * 2.4934969119414263 - y * 0.9313836179191242 - 0.402710784450717 * z,
      g: x * -0.8294889695615749 + y * 1.7626640603183465 + 0.0236246858419436 * z,
      b: x * 0.0358458302437845 - y * 0.0761723892680418 + 0.9568845240076871 * z
    },
    "p3"
  );
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const definition$6 = {
  ...definition$r,
  mode: "p3",
  parse: ["display-p3"],
  serialize: "display-p3",
  fromMode: {
    rgb: (color) => convertXyz65ToP3(convertRgbToXyz65(color)),
    xyz65: convertXyz65ToP3
  },
  toMode: {
    rgb: (color) => convertXyz65ToRgb(convertP3ToXyz65(color)),
    xyz65: convertP3ToXyz65
  }
};
const gamma$1 = (v) => {
  let abs2 = Math.abs(v);
  if (abs2 >= 1 / 512) {
    return Math.sign(v) * Math.pow(abs2, 1 / 1.8);
  }
  return 16 * v;
};
const convertXyz50ToProphoto = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = {
    mode: "prophoto",
    r: gamma$1(
      x * 1.3457868816471585 - y * 0.2555720873797946 - 0.0511018649755453 * z
    ),
    g: gamma$1(
      x * -0.5446307051249019 + y * 1.5082477428451466 + 0.0205274474364214 * z
    ),
    b: gamma$1(x * 0 + y * 0 + 1.2119675456389452 * z)
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const linearize$1 = (v = 0) => {
  let abs2 = Math.abs(v);
  if (abs2 >= 16 / 512) {
    return Math.sign(v) * Math.pow(abs2, 1.8);
  }
  return v / 16;
};
const convertProphotoToXyz50 = (prophoto) => {
  let r = linearize$1(prophoto.r);
  let g = linearize$1(prophoto.g);
  let b = linearize$1(prophoto.b);
  let res = {
    mode: "xyz50",
    x: 0.7977666449006423 * r + 0.1351812974005331 * g + 0.0313477341283922 * b,
    y: 0.2880748288194013 * r + 0.7118352342418731 * g + 899369387256e-16 * b,
    z: 0 * r + 0 * g + 0.8251046025104602 * b
  };
  if (prophoto.alpha !== void 0) {
    res.alpha = prophoto.alpha;
  }
  return res;
};
const definition$5 = {
  ...definition$r,
  mode: "prophoto",
  parse: ["prophoto-rgb"],
  serialize: "prophoto-rgb",
  fromMode: {
    xyz50: convertXyz50ToProphoto,
    rgb: (color) => convertXyz50ToProphoto(convertRgbToXyz50(color))
  },
  toMode: {
    xyz50: convertProphotoToXyz50,
    rgb: (color) => convertXyz50ToRgb(convertProphotoToXyz50(color))
  }
};
const α$1 = 1.09929682680944;
const β$1 = 0.018053968510807;
const gamma = (v) => {
  const abs2 = Math.abs(v);
  if (abs2 > β$1) {
    return (Math.sign(v) || 1) * (α$1 * Math.pow(abs2, 0.45) - (α$1 - 1));
  }
  return 4.5 * v;
};
const convertXyz65ToRec2020 = ({ x, y, z, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = {
    mode: "rec2020",
    r: gamma(
      x * 1.7166511879712683 - y * 0.3556707837763925 - 0.2533662813736599 * z
    ),
    g: gamma(
      x * -0.6666843518324893 + y * 1.6164812366349395 + 0.0157685458139111 * z
    ),
    b: gamma(
      x * 0.0176398574453108 - y * 0.0427706132578085 + 0.9421031212354739 * z
    )
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const α = 1.09929682680944;
const β = 0.018053968510807;
const linearize = (v = 0) => {
  let abs2 = Math.abs(v);
  if (abs2 < β * 4.5) {
    return v / 4.5;
  }
  return (Math.sign(v) || 1) * Math.pow((abs2 + α - 1) / α, 1 / 0.45);
};
const convertRec2020ToXyz65 = (rec2020) => {
  let r = linearize(rec2020.r);
  let g = linearize(rec2020.g);
  let b = linearize(rec2020.b);
  let res = {
    mode: "xyz65",
    x: 0.6369580483012911 * r + 0.1446169035862083 * g + 0.1688809751641721 * b,
    y: 0.262700212011267 * r + 0.6779980715188708 * g + 0.059301716469862 * b,
    z: 0 * r + 0.0280726930490874 * g + 1.0609850577107909 * b
  };
  if (rec2020.alpha !== void 0) {
    res.alpha = rec2020.alpha;
  }
  return res;
};
const definition$4 = {
  ...definition$r,
  mode: "rec2020",
  fromMode: {
    xyz65: convertXyz65ToRec2020,
    rgb: (color) => convertXyz65ToRec2020(convertRgbToXyz65(color))
  },
  toMode: {
    xyz65: convertRec2020ToXyz65,
    rgb: (color) => convertXyz65ToRgb(convertRec2020ToXyz65(color))
  },
  parse: ["rec2020"],
  serialize: "rec2020"
};
const bias = 0.0037930732552754493;
const bias_cbrt = Math.cbrt(bias);
const transfer$1 = (v) => Math.cbrt(v) - bias_cbrt;
const convertRgbToXyb = (color) => {
  const { r, g, b, alpha } = convertRgbToLrgb(color);
  const l = transfer$1(0.3 * r + 0.622 * g + 0.078 * b + bias);
  const m = transfer$1(0.23 * r + 0.692 * g + 0.078 * b + bias);
  const s = transfer$1(
    0.2434226892454782 * r + 0.2047674442449682 * g + 0.5518098665095535 * b + bias
  );
  const res = {
    mode: "xyb",
    x: (l - m) / 2,
    y: (l + m) / 2,
    /* Apply default chroma from luma (subtract Y from B) */
    b: s - (l + m) / 2
  };
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const transfer = (v) => Math.pow(v + bias_cbrt, 3);
const convertXybToRgb = ({ x, y, b, alpha }) => {
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (b === void 0) b = 0;
  const l = transfer(x + y) - bias;
  const m = transfer(y - x) - bias;
  const s = transfer(b + y) - bias;
  const res = convertLrgbToRgb({
    r: 11.031566904639861 * l - 9.866943908131562 * m - 0.16462299650829934 * s,
    g: -3.2541473810744237 * l + 4.418770377582723 * m - 0.16462299650829934 * s,
    b: -3.6588512867136815 * l + 2.7129230459360922 * m + 1.9459282407775895 * s
  });
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const definition$3 = {
  mode: "xyb",
  channels: ["x", "y", "b", "alpha"],
  parse: ["--xyb"],
  serialize: "--xyb",
  toMode: {
    rgb: convertXybToRgb
  },
  fromMode: {
    rgb: convertRgbToXyb
  },
  ranges: {
    x: [-0.0154, 0.0281],
    y: [0, 0.8453],
    b: [-0.2778, 0.388]
  },
  interpolate: {
    x: interpolatorLinear,
    y: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const definition$2 = {
  mode: "xyz50",
  parse: ["xyz-d50"],
  serialize: "xyz-d50",
  toMode: {
    rgb: convertXyz50ToRgb,
    lab: convertXyz50ToLab
  },
  fromMode: {
    rgb: convertRgbToXyz50,
    lab: convertLabToXyz50
  },
  channels: ["x", "y", "z", "alpha"],
  ranges: {
    x: [0, 0.964],
    y: [0, 0.999],
    z: [0, 0.825]
  },
  interpolate: {
    x: interpolatorLinear,
    y: interpolatorLinear,
    z: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const convertXyz65ToXyz50 = (xyz65) => {
  let { x, y, z, alpha } = xyz65;
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = {
    mode: "xyz50",
    x: 1.0479298208405488 * x + 0.0229467933410191 * y - 0.0501922295431356 * z,
    y: 0.0296278156881593 * x + 0.990434484573249 * y - 0.0170738250293851 * z,
    z: -0.0092430581525912 * x + 0.0150551448965779 * y + 0.7518742899580008 * z
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const convertXyz50ToXyz65 = (xyz50) => {
  let { x, y, z, alpha } = xyz50;
  if (x === void 0) x = 0;
  if (y === void 0) y = 0;
  if (z === void 0) z = 0;
  let res = {
    mode: "xyz65",
    x: 0.9554734527042182 * x - 0.0230985368742614 * y + 0.0632593086610217 * z,
    y: -0.0283697069632081 * x + 1.0099954580058226 * y + 0.021041398966943 * z,
    z: 0.0123140016883199 * x - 0.0205076964334779 * y + 1.3303659366080753 * z
  };
  if (alpha !== void 0) {
    res.alpha = alpha;
  }
  return res;
};
const definition$1 = {
  mode: "xyz65",
  toMode: {
    rgb: convertXyz65ToRgb,
    xyz50: convertXyz65ToXyz50
  },
  fromMode: {
    rgb: convertRgbToXyz65,
    xyz50: convertXyz50ToXyz65
  },
  ranges: {
    x: [0, 0.95],
    y: [0, 1],
    z: [0, 1.088]
  },
  channels: ["x", "y", "z", "alpha"],
  parse: ["xyz", "xyz-d65"],
  serialize: "xyz-d65",
  interpolate: {
    x: interpolatorLinear,
    y: interpolatorLinear,
    z: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const convertRgbToYiq = ({ r, g, b, alpha }) => {
  if (r === void 0) r = 0;
  if (g === void 0) g = 0;
  if (b === void 0) b = 0;
  const res = {
    mode: "yiq",
    y: 0.29889531 * r + 0.58662247 * g + 0.11448223 * b,
    i: 0.59597799 * r - 0.2741761 * g - 0.32180189 * b,
    q: 0.21147017 * r - 0.52261711 * g + 0.31114694 * b
  };
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const convertYiqToRgb = ({ y, i, q, alpha }) => {
  if (y === void 0) y = 0;
  if (i === void 0) i = 0;
  if (q === void 0) q = 0;
  const res = {
    mode: "rgb",
    r: y + 0.95608445 * i + 0.6208885 * q,
    g: y - 0.27137664 * i - 0.6486059 * q,
    b: y - 1.10561724 * i + 1.70250126 * q
  };
  if (alpha !== void 0) res.alpha = alpha;
  return res;
};
const definition = {
  mode: "yiq",
  toMode: {
    rgb: convertYiqToRgb
  },
  fromMode: {
    rgb: convertRgbToYiq
  },
  channels: ["y", "i", "q", "alpha"],
  parse: ["--yiq"],
  serialize: "--yiq",
  ranges: {
    i: [-0.595, 0.595],
    q: [-0.522, 0.522]
  },
  interpolate: {
    y: interpolatorLinear,
    i: interpolatorLinear,
    q: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
};
const clamp = (value) => Math.max(0, Math.min(1, value || 0));
const fixup = (value) => Math.round(clamp(value) * 255);
const rgb = converter("rgb");
const serializeHex = (color) => {
  if (color === void 0) {
    return void 0;
  }
  let r = fixup(color.r);
  let g = fixup(color.g);
  let b = fixup(color.b);
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
};
const formatHex = (c2) => serializeHex(rgb(c2));
const normalizePositions = (arr) => {
  if (arr[0] === void 0) {
    arr[0] = 0;
  }
  if (arr[arr.length - 1] === void 0) {
    arr[arr.length - 1] = 1;
  }
  let i = 1;
  let j;
  let from_idx;
  let from_pos;
  let inc;
  while (i < arr.length) {
    if (arr[i] === void 0) {
      from_idx = i;
      from_pos = arr[i - 1];
      j = i;
      while (arr[j] === void 0) j++;
      inc = (arr[j] - from_pos) / (j - i + 1);
      while (i < j) {
        arr[i] = from_pos + (i + 1 - from_idx) * inc;
        i++;
      }
    } else if (arr[i] < arr[i - 1]) {
      arr[i] = arr[i - 1];
    }
    i++;
  }
  return arr;
};
const midpoint = (H = 0.5) => (t) => H <= 0 ? 1 : H >= 1 ? 0 : Math.pow(t, Math.log(0.5) / Math.log(H));
const isfn = (o) => typeof o === "function";
const isobj = (o) => o && typeof o === "object";
const isnum = (o) => typeof o === "number";
const interpolate_fn = (colors, mode = "rgb", overrides, premap) => {
  let def = getMode(mode);
  let conv = converter(mode);
  let conv_colors = [];
  let positions = [];
  let fns = {};
  colors.forEach((val) => {
    if (Array.isArray(val)) {
      conv_colors.push(conv(val[0]));
      positions.push(val[1]);
    } else if (isnum(val) || isfn(val)) {
      fns[positions.length] = val;
    } else {
      conv_colors.push(conv(val));
      positions.push(void 0);
    }
  });
  normalizePositions(positions);
  let fixed = def.channels.reduce((res, ch) => {
    let ffn;
    if (isobj(overrides) && isobj(overrides[ch]) && overrides[ch].fixup) {
      ffn = overrides[ch].fixup;
    } else if (isobj(def.interpolate[ch]) && def.interpolate[ch].fixup) {
      ffn = def.interpolate[ch].fixup;
    } else {
      ffn = (v) => v;
    }
    res[ch] = ffn(conv_colors.map((color) => color[ch]));
    return res;
  }, {});
  let interpolators = def.channels.reduce((res, ch) => {
    let ifn;
    if (isfn(overrides)) {
      ifn = overrides;
    } else if (isobj(overrides) && isfn(overrides[ch])) {
      ifn = overrides[ch];
    } else if (isobj(overrides) && isobj(overrides[ch]) && overrides[ch].use) {
      ifn = overrides[ch].use;
    } else if (isfn(def.interpolate[ch])) {
      ifn = def.interpolate[ch];
    } else if (isobj(def.interpolate[ch])) {
      ifn = def.interpolate[ch].use;
    }
    res[ch] = ifn(fixed[ch]);
    return res;
  }, {});
  let n = conv_colors.length - 1;
  return (t) => {
    t = Math.min(Math.max(0, t), 1);
    if (t <= positions[0]) {
      return conv_colors[0];
    }
    if (t > positions[n]) {
      return conv_colors[n];
    }
    let idx = 0;
    while (positions[idx] < t) idx++;
    let start = positions[idx - 1];
    let delta = positions[idx] - start;
    let P = (t - start) / delta;
    let fn2 = fns[idx] || fns[0];
    if (fn2 !== void 0) {
      if (isnum(fn2)) {
        fn2 = midpoint((fn2 - start) / delta);
      }
      P = fn2(P);
    }
    let t0 = (idx - 1 + P) / n;
    return def.channels.reduce(
      (res, channel) => {
        let val = interpolators[channel](t0);
        if (val !== void 0) {
          res[channel] = val;
        }
        return res;
      },
      { mode }
    );
  };
};
const interpolate = (colors, mode = "rgb", overrides) => interpolate_fn(colors, mode, overrides);
function luminance(color) {
  let c2 = converter("lrgb")(color);
  return 0.2126 * c2.r + 0.7152 * c2.g + 0.0722 * c2.b;
}
function contrast$1(a, b) {
  let L1 = luminance(a);
  let L2 = luminance(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
useMode(definition$q);
useMode(definition$p);
useMode(definition$o);
useMode(definition$n);
useMode(definition$m);
useMode(definition$l);
useMode(definition$k);
useMode(definition$j);
useMode(definition$i);
useMode(definition$h);
useMode(definition$g);
useMode(definition$f);
useMode(definition$e);
useMode(definition$d);
useMode(definition$c);
useMode(definition$b);
useMode(definition$a);
useMode(definition$9);
useMode(modeOkhsl);
useMode(modeOkhsv);
useMode(definition$8);
useMode(definition$7);
useMode(definition$6);
useMode(definition$5);
useMode(definition$4);
useMode(definition$r);
useMode(definition$3);
useMode(definition$2);
useMode(definition$1);
useMode(definition);
function isColor(value) {
  return parse(value) !== void 0;
}
function mix(a, b, t) {
  return formatHex(interpolate([a, b], "oklch")(t)).toUpperCase();
}
function contrast(a, b) {
  return Math.round(contrast$1(a, b) * 100) / 100;
}
const CORE_ROLES = ["canvas", "ink", "primary", "accent"];
function deriveRoles(colors) {
  const c2 = { ...colors };
  const missing = CORE_ROLES.filter((r) => !c2[r]);
  if (missing.length) throw new Error(`missing core roles: ${missing.join(", ")}`);
  c2.surface ??= mix(c2.canvas, c2.ink, 0.06);
  if (!c2["ink-muted"]) {
    let t = 0.4;
    while (t > 0 && contrast(mix(c2.ink, c2.canvas, t), c2.canvas) < 3) t -= 0.05;
    c2["ink-muted"] = mix(c2.ink, c2.canvas, Math.max(0, t));
  }
  c2.line ??= mix(c2.ink, c2.canvas, 0.8);
  c2.secondary ??= mix(c2.primary, c2.ink, 0.35);
  if (!c2["on-primary"]) {
    const candidates = [c2.ink, c2.canvas, "#FFFFFF", "#000000"];
    c2["on-primary"] = candidates.reduce((best, x) => contrast(x, c2.primary) > contrast(best, c2.primary) ? x : best);
  }
  return c2;
}
const TokensSchema = objectType({
  version: stringType().optional(),
  name: stringType().optional(),
  colors: recordType(stringType(), stringType()).default({}),
  typography: recordType(stringType(), recordType(stringType(), unionType([stringType(), numberType()]))).default({}),
  spacing: recordType(stringType(), unionType([stringType(), numberType()])).default({}),
  rounded: recordType(stringType(), stringType()).default({}),
  components: recordType(stringType(), recordType(stringType(), stringType())).default({})
}).passthrough();
const REF = /^\{([A-Za-z0-9_.-]+)\}$/;
function lookup(root, path2) {
  return path2.split(".").reduce((o, k2) => o && typeof o === "object" ? o[k2] : void 0, root);
}
function resolveRefs(value, root, issues, seen = []) {
  if (typeof value === "string") {
    const m = REF.exec(value);
    if (!m) return value;
    if (seen.includes(m[1])) {
      issues.push(`circular reference: ${[...seen, m[1]].join(" -> ")}`);
      return value;
    }
    const target = lookup(root, m[1]);
    if (target === void 0) {
      issues.push(`broken reference: ${value}`);
      return value;
    }
    return resolveRefs(target, root, issues, [...seen, m[1]]);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k2, v]) => [k2, resolveRefs(v, root, issues, seen)]));
  }
  return value;
}
function parseDesign(text) {
  const split = splitFrontMatter(text);
  const issues = [];
  if (!split.hasFrontMatter) issues.push("no YAML front matter: tokens unavailable (prose-only DESIGN.md)");
  const raw = split.hasFrontMatter ? distExports.parse(split.yaml) ?? {} : {};
  const parsed = TokensSchema.safeParse(raw);
  if (!parsed.success) {
    issues.push(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const tokens = parsed.success ? parsed.data : TokensSchema.parse({});
  const resolved = resolveRefs(tokens, tokens, issues);
  for (const [k2, v] of Object.entries(resolved.colors)) if (!isColor(v)) issues.push(`colors.${k2}: invalid color ${v}`);
  let colors = resolved.colors;
  try {
    colors = deriveRoles(resolved.colors);
  } catch (e2) {
    issues.push(e2.message);
  }
  return { tokens: resolved, colors, issues };
}
const ID = "virtual:vanilla/design";
const RESOLVED = "\0" + ID;
const FATAL = (issue) => issue.startsWith("missing core roles") || issue.includes("invalid color") || issue.startsWith("no YAML front matter");
function toRuntimeDesign(parsed) {
  const t = parsed.tokens;
  const body = {
    colors: parsed.colors,
    typography: t.typography,
    spacing: t.spacing,
    rounded: t.rounded
  };
  const hash = createHash("sha1").update(JSON.stringify(body)).digest("hex").slice(0, 12);
  return { ...body, hash };
}
function loadDesign(text, previous) {
  let parsed;
  try {
    parsed = parseDesign(text);
  } catch (e2) {
    return { design: previous, stale: previous !== null, issues: [`unreadable: ${e2.message}`] };
  }
  if (parsed.issues.some(FATAL)) return { design: previous, stale: previous !== null, issues: parsed.issues };
  return { design: toRuntimeDesign(parsed), stale: false, issues: parsed.issues };
}
function vanillaDesign(file = "DESIGN.md") {
  let designPath = "";
  let isBuild = false;
  let last = null;
  return {
    name: "vanilla-design",
    configResolved(config) {
      designPath = path.resolve(config.root, file);
      isBuild = config.command === "build";
    },
    resolveId: (id) => id === ID ? RESOLVED : void 0,
    load(id) {
      if (id !== RESOLVED) return;
      this.addWatchFile(designPath);
      let text = "";
      let readError = null;
      try {
        text = readFileSync(designPath, "utf8");
      } catch (e2) {
        readError = e2.message;
      }
      const result = readError ? { design: last, stale: last !== null, issues: [readError] } : loadDesign(text, last);
      if (result.design) last = result.design;
      if (result.stale || !result.design) {
        const message = `DESIGN.md: ${result.issues.join("; ")}`;
        if (isBuild && !result.design) this.error(message);
        this.warn(message);
      }
      const design = result.design ?? { colors: {}, typography: {}, spacing: {}, rounded: {}, hash: "none" };
      return `export default ${JSON.stringify(design)};`;
    },
    handleHotUpdate({ file: changed, server }) {
      if (path.resolve(changed) !== designPath) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED);
      if (!mod) return;
      server.moduleGraph.invalidateModule(mod);
      return [mod];
    }
  };
}
export {
  loadDesign,
  toRuntimeDesign,
  vanillaDesign
};
