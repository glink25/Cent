declare var window: {
    _IsFromRapidReducedMotionChange?: boolean;
};

export const setIsFromRapidReducedMotionChange = () => {
    window._IsFromRapidReducedMotionChange = true;
};

export const getIsFromRapidReducedMotionChange = () => {
    setTimeout(() => {
        window._IsFromRapidReducedMotionChange = undefined;
    }, 2000);
    return window._IsFromRapidReducedMotionChange;
};
