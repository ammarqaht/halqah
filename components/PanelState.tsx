'use client';
import { createContext, useContext } from 'react';

export const PanelState = createContext<{ panelOpen: boolean; setPanelOpen: (v: boolean) => void }>({
  panelOpen: true, setPanelOpen: () => {},
});
export const usePanel = () => useContext(PanelState);
