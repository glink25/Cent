
export type Budget = {
    id: string
    title: string;
    start: number
    end?: number
    repeat: {
        unit: 'week' | 'day' | 'month' | 'year',
        value: number
    };
    joiners: (string | number)[]
    totalBudget: number
    categoriesBudget?: {
        id: string,
        budget: number
    }[]
}

export type EditBudget = Omit<Budget, 'id'> & { id?: string }