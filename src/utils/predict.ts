import { StorageDeferredAPI } from "@/api/storage";
import { useBookStore } from "@/store/book";

let preidctResult:
    | {
          category?: string[] | undefined;
          comment?: string[] | undefined;
          predictTime: number;
      }
    | undefined;

let timer: NodeJS.Timeout | undefined;

export const startBackgroundPredict = () => {
    if (timer) {
        return;
    }
    const book = useBookStore.getState().currentBookId;
    if (!book) {
        return;
    }
    const run = () => {
        const now = Date.now();
        StorageDeferredAPI.predict(book, "category").then((predicts) => {
            preidctResult = {
                ...preidctResult,
                predictTime: now,
                category: predicts,
            };
        });
        StorageDeferredAPI.predict(book, "comment").then((predicts) => {
            preidctResult = {
                ...preidctResult,
                predictTime: now,
                comment: predicts,
            };
        });
    };
    // 每分钟刷新
    timer = setInterval(run, 60 * 1000);
    StorageDeferredAPI.learn(book).then(run);
};

export const getPredictNow = () => preidctResult;

export const stopBackgroundPredict = () => {
    clearInterval(timer);
    preidctResult = undefined;
};
