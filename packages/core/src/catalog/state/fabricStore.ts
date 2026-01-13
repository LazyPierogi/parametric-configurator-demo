import {Fabric} from "../types";

let selectedFabric: Fabric | null = null;

export function setSelectedFabric(f: Fabric | null) {
    selectedFabric = f;
}

export function getSelectedFabric() {
    return selectedFabric;
}
