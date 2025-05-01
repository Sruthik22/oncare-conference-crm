import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Attendee, HealthSystem, Conference } from '@/types';

type ItemType = Attendee | HealthSystem | Conference;

interface SelectionContextType {
  selectedItems: ItemType[];
  isSelected: (item: ItemType) => boolean;
  toggleSelection: (item: ItemType) => void;
  selectAll: (items: ItemType[]) => void;
  deselectAll: () => void;
  selectedCount: number;
  savedSelections: { name: string; items: ItemType[] }[];
  saveCurrentSelection: (name: string) => void;
  loadSelection: (name: string) => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedItems, setSelectedItems] = useState<ItemType[]>([]);
  const [savedSelections, setSavedSelections] = useState<{ name: string; items: ItemType[] }[]>([]);

  const isSelected = useCallback((item: ItemType) => {
    return selectedItems.some(i => i.id === item.id);
  }, [selectedItems]);

  const toggleSelection = useCallback((item: ItemType) => {
    setSelectedItems(prev => {
      if (isSelected(item)) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  }, [isSelected]);

  const selectAll = useCallback((items: ItemType[]) => {
    setSelectedItems(items);
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const saveCurrentSelection = useCallback((name: string) => {
    setSavedSelections(prev => [...prev, { name, items: selectedItems }]);
  }, [selectedItems]);

  const loadSelection = useCallback((name: string) => {
    const selection = savedSelections.find(s => s.name === name);
    if (selection) {
      setSelectedItems(selection.items);
    }
  }, [savedSelections]);

  return (
    <SelectionContext.Provider
      value={{
        selectedItems,
        isSelected,
        toggleSelection,
        selectAll,
        deselectAll,
        selectedCount: selectedItems.length,
        savedSelections,
        saveCurrentSelection,
        loadSelection,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
} 