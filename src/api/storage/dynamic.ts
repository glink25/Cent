const loaded = import("@/api/storage");

export const loadStorageAPI = async () => {
    const lib = await loaded;
    return lib;
};
