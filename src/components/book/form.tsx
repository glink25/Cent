import { useEffect, useState } from "react";
import type { Book } from "@/api/endpoints/type";
import { loadStorageAPI } from "@/api/storage/dynamic";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useIsLogin } from "@/store/user";
import Loading from "../loading";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export function BookForm() {
    console.log("bookfo");
    const t = useIntl();
    const isLogin = useIsLogin();
    const { books, currentBookId, loading } = useBookStore();
    // const bookNum = books.length;

    const [creating, setCreating] = useState(false);

    const [core, setCore] = useState<
        Awaited<ReturnType<typeof loadStorageAPI>> | undefined
    >(undefined);
    useEffect(() => {
        loadStorageAPI().then((v) => {
            setCore(v);
        });
    }, []);

    if (!isLogin) {
        return null;
    }

    const toSwitchBook = (bookId: string) => {
        useBookStore.getState().switchToBook(bookId);
    };
    const toInvite = async (book: Book) => {
        const { StorageAPI } = await loadStorageAPI();
        StorageAPI.initBook?.(book.id);
    };

    const toDelete = async (book: Book) => {
        const { StorageAPI } = await loadStorageAPI();
        try {
            await StorageAPI.deleteBook(book.id);
            useBookStore.getState().switchToBook(undefined);
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className="w-fit h-full flex justify-center items-center pointer-events-auto">
            <div className="bg-background w-[350px] h-[480px] max-h-[55vh] py-4 flex flex-col justify-center items-center rounded">
                {books.length > 0 ? (
                    <div className="flex-1 flex flex-col w-full gap-2 h-full overflow-hidden">
                        <div className="flex gap-2 px-4">
                            {t("select-a-book")}
                            {loading && <Loading></Loading>}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 px-4 overflow-y-auto">
                            {books.map((book) => {
                                return (
                                    <Label
                                        key={book.id}
                                        className="flex-shrink-0 cursor-pointer hover:bg-accent/50 overflow-hidden flex items-center gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950"
                                    >
                                        <Checkbox
                                            checked={book.id === currentBookId}
                                            onCheckedChange={(v) => {
                                                if (v) {
                                                    toSwitchBook(book.id);
                                                }
                                            }}
                                            className="inline-flex items-center data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                                        />
                                        <div className="flex-1 flex justify-between gap-1.5 font-normal overflow-hidden">
                                            <div className="flex-1 text-sm leading-none font-medium flex flex-col gap-1 overflow-hidden">
                                                <p>{book.name}</p>
                                                <span className="text-xs opacity-60 truncate">
                                                    {book.id}
                                                </span>
                                            </div>
                                            <div className="flex gap-1 items-center">
                                                {core?.StorageAPI
                                                    .inviteForBook && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            toInvite(book)
                                                        }
                                                    >
                                                        {t("invite")}
                                                    </Button>
                                                )}
                                                {currentBookId !== book.id && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() =>
                                                            toDelete(book)
                                                        }
                                                    >
                                                        {t("delete")}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Label>
                                );
                            })}
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex-1">
                        <Loading>{t("loading-books")}</Loading>
                    </div>
                ) : (
                    <div className="flex-1">{t("no-books-go-create-one")}</div>
                )}
                <Button
                    disabled={creating}
                    onClick={async () => {
                        const name = prompt(t("please-input-book-name"));
                        if (!name) {
                            return;
                        }
                        setCreating(true);
                        const { StorageAPI } = await loadStorageAPI();
                        try {
                            const store = await StorageAPI.createBook(name);
                            await useBookStore.getState().updateBookList();
                        } finally {
                            setCreating(false);
                        }
                    }}
                >
                    {creating && <Loading />}
                    {t("create-new-book")}
                </Button>
            </div>
        </div>
    );
}

export function BookConfirmForm({
    edit,
}: {
    edit?: any;
    onCancel?: () => void;
    onConfirm?: (v: any) => void;
}) {
    return (
        <div>
            <BookForm />
        </div>
    );
}
