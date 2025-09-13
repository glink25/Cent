import { Button } from "../ui/button";

export default function CategoryManerger() {
    return (
        <div className="backup">
            <Button onClick={() => { }} variant='ghost' className="w-full py-4 rounded-none h-auto">
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--category-outline] size-5"></i>
                        Edit Categories
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
        </div>
    );
}
