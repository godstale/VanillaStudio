import { createContext, useContext } from 'react';
import { EMPTY_DESIGN, type Design } from './types';

export const DesignContext = createContext<Design>(EMPTY_DESIGN);

export const useDesign = (): Design => useContext(DesignContext);
