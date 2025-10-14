import { Dialog, VisuallyHidden } from "radix-ui";
import { useState } from "react";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { FORMAT_BACKUP, showFilePicker } from "../file-picker";
import { Button } from "../ui/button";
import { OncentImport, showOncentImport } from "./oncent";

export default function Backup() {
    const t = useIntl();
    const [visible, setVisible] = useState(false);
    const toImport = async () => {
        const [jsonFile] = await showFilePicker({ accept: FORMAT_BACKUP });
        const jsonText = await jsonFile.text();
        const data = JSON.parse(jsonText);
        await showOncentImport(data);
    };
    return (
        <div className="backup">
            <Button
                onClick={() => {
                    setVisible(true);
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--tray-upload] size-5"></i>
                        {t("backup")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <Dialog.Root open={visible} onOpenChange={setVisible}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlay-show"></Dialog.Overlay>
                    <Dialog.Content>
                        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center pointer-events-none">
                            <Dialog.Content
                                className={cn(
                                    "bg-white max-h-[55vh] w-fit max-w-[500px] rounded-md data-[state=open]:animate-content-show",
                                )}
                            >
                                <VisuallyHidden.Root>
                                    <Dialog.Title>{t("backup")} </Dialog.Title>
                                    <Dialog.Description>
                                        {t("backup")}{" "}
                                    </Dialog.Description>
                                </VisuallyHidden.Root>
                                <div className="w-fit h-full flex justify-center items-center pointer-events-auto">
                                    <div className="bg-[white] w-[350px] h-[450px] py-4 flex flex-col justify-center items-center rounded">
                                        <div className="flex-1 flex flex-col w-full gap-2 h-full overflow-hidden">
                                            <div className="flex gap-2 px-4">
                                                {t("backup")}{" "}
                                            </div>
                                            <div className="flex flex-col px-4">
                                                <Button
                                                    variant="outline"
                                                    className="py-4"
                                                    onClick={toImport}
                                                >
                                                    {t(
                                                        "import-from-oncent-github-io",
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Content>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
            <OncentImport />
        </div>
    );
}
