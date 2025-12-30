import { useBookStore } from "@/store/book";

export const showBookGuide = () => {
    useBookStore.setState((prev) => ({
        ...prev,
        visible: true,
    }));
};
