import { emptyPropertyData } from '@/constants/emptyPropertyData';
import { propertyReducer, PropertyReducerAction } from '@/sidepanel/propertyReducer';
import { ExtractedPropertyScrapingData } from '@/types/property';
import React, { createContext, useContext, useReducer } from 'react';

interface PropertyDataContextProps {
    propertyData: ExtractedPropertyScrapingData;
    dispatch: React.Dispatch<PropertyReducerAction>;
}

const PropertyDataContext = createContext<PropertyDataContextProps | undefined>(undefined)

export const PropertyDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [propertyData, dispatch] = useReducer(propertyReducer, emptyPropertyData)

    return (
        <PropertyDataContext.Provider value={{ propertyData, dispatch }}>
            {children}
        </PropertyDataContext.Provider>
    )
}

export const usePropertyData = (): PropertyDataContextProps => {
    const context = useContext(PropertyDataContext)
    if (!context) {
        throw new Error('usePropertyData must be used within a PropertyDataProvider')
    }
    return context
}
