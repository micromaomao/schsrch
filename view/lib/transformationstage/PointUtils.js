let getClientOffsetCache = null;
export function getClientOffset(view) {
    let rect = null;
    if (getClientOffsetCache && getClientOffsetCache.target === view) {
        rect = getClientOffsetCache.rect;
    }
    else {
        rect = view.getBoundingClientRect();
        getClientOffsetCache = {
            target: view,
            rect
        };
    }
    return [rect.left, rect.top];
}
function removeClientOffsetCache() {
    getClientOffsetCache = null;
    requestAnimationFrame(removeClientOffsetCache);
}
try {
    removeClientOffsetCache();
}
catch (e) { }
export function client2view(point, view) {
    let cOffset = getClientOffset(view);
    return [
        point[0] - cOffset[0],
        point[1] - cOffset[1]
    ];
}
export function view2client(point, view) {
    let cOffset = getClientOffset(view);
    return [
        point[0] + cOffset[0],
        point[1] + cOffset[1]
    ];
}
export function pointDistance(a, b) {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}
