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
    const book = useBookStore.getState().currentBookId;
    if (!book) {
        return;
    }
    StorageDeferredAPI.learn(book);

    const run = () => {
        const now = Date.now();
        StorageDeferredAPI.predict(book, "category", +16 * 60 * 60 * 1000).then(
            (predicts) => {
                preidctResult = {
                    ...preidctResult,
                    predictTime: now,
                    category: predicts,
                };
            },
        );
        StorageDeferredAPI.predict(book, "comment", now).then((predicts) => {
            preidctResult = {
                ...preidctResult,
                predictTime: now,
                comment: predicts,
            };
        });
    };
    timer = setInterval(run, 60000);
    run();
};

export const getPredictNow = () => preidctResult;

export const stopBackgroundPredict = () => {
    clearInterval(timer);
    preidctResult = undefined;
};
