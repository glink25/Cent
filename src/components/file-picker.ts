type PickerParam = {
	accept: string;
	multiple: boolean;
};

export const FORMAT_ALL = "*";

export const FORMAT_IMAGE = "image/*";

export const FORMAT_IMAGE_SUPPORTED =
	"image/png,image/jpeg,image/gif,image/webp";

export const FORMAT_BACKUP = ".json,application/json";

export const showFilePicker = ({ accept, multiple }: Partial<PickerParam>) => {
	const picker = document.createElement("input");
	picker.type = "file";
	picker.accept = accept ?? FORMAT_ALL;
	picker.multiple = multiple ?? false;
	return new Promise<File[]>((res, rej) => {
		picker.addEventListener("change", () => {
			if (picker.files === null) {
				rej();
				return;
			}
			res(Array.from(picker.files));
		});
		picker.addEventListener("error", rej);
		picker.click();
	});
};
