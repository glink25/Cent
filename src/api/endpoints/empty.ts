import type { SyncEndpointFactory } from "./type";

export const createEmptyEndpoint: SyncEndpointFactory = () => {
    return {} as any;
};
