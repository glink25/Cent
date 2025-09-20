interface FileEntry<V> {
    key: string;
    file: File;
    formattedValue: V;
}

/**
 * Recursively transforms a nested object or array, replacing File objects
 * with their formatted value and collecting the original File objects
 * along with their formatted values.
 *
 * @param data The object or array to transform.
 * @param format A function that takes a File object and returns a formatted value.
 * @returns An object containing the transformed data and an array of all File objects found, with their corresponding keys and formatted values.
 */
export function transformAssets<T extends object, V>(
    data: T,
    format: (file: File) => V,
) {
    const files: FileEntry<V>[] = [];

    const traverse = (currentData: unknown, path: string): unknown => {
        if (currentData instanceof File) {
            const formattedValue = format(currentData);
            files.push({ key: path, file: currentData, formattedValue });
            return formattedValue;
        }

        if (Array.isArray(currentData)) {
            return currentData.map((item, index) =>
                traverse(item, `${path}[${index}]`),
            );
        }

        if (typeof currentData === "object" && currentData !== null) {
            const transformedObject: Record<string, unknown> = {};
            for (const key in currentData) {
                if (Object.hasOwn(currentData, key)) {
                    transformedObject[key] = traverse(
                        (currentData as Record<string, unknown>)[key],
                        path ? `${path}.${key}` : key,
                    );
                }
            }
            return transformedObject;
        }

        return currentData;
    };

    const transformedData = traverse(data, "") as T;

    return [transformedData, files] as const;
}
