
import { useEffect, useRef, useState } from 'react';
import { createOptimizedPopper } from '../utils/popper-optimization';
import { Instance } from '@popperjs/core';

interface UseLazyTooltipResult {
    referenceRef: (node: HTMLElement | null) => void;
    tooltipRef: (node: HTMLElement | null) => void;
    isVisible: boolean;
    show: () => void;
    hide: () => void;
}

/**
 * A hook to lazily instantiate a tooltip using optimized Popper settings.
 * 
 * It waits for the first 'mouseenter' or 'focus' event on the reference element
 * before initializing the Popper instance.
 * 
 * @param options - Custom Popper options
 * @returns references and visibility controls
 */
export function useLazyTooltip(options = {}): UseLazyTooltipResult {
    const [isVisible, setIsVisible] = useState(false);
    const [popperInstance, setPopperInstance] = useState<Instance | null>(null);

    const referenceNode = useRef<HTMLElement | null>(null);
    const tooltipNode = useRef<HTMLElement | null>(null);

    const show = () => setIsVisible(true);
    const hide = () => setIsVisible(false);

    // Callback refs to handle node updates
    const referenceRef = (node: HTMLElement | null) => {
        referenceNode.current = node;
    };

    const tooltipRef = (node: HTMLElement | null) => {
        tooltipNode.current = node;
    };

    useEffect(() => {
        const reference = referenceNode.current;
        if (!reference) return;

        let initialized = false;

        const handleInteraction = () => {
            if (initialized) return;
            initialized = true;

            // Only initialize Popper if both nodes exist (tooltip node might be conditional)
            // But usually we need to set state to render the tooltip *then* initialize.
            // Simplified: We always manage visibility state.
            // The popper creation happens when *both* are present.
        };

        const onMouseEnter = () => {
            handleInteraction();
            show();
        };

        const onFocus = () => {
            handleInteraction();
            show();
        };

        const onMouseLeave = () => hide();
        const onBlur = () => hide();

        reference.addEventListener('mouseenter', onMouseEnter);
        reference.addEventListener('focus', onFocus);
        reference.addEventListener('mouseleave', onMouseLeave);
        reference.addEventListener('blur', onBlur);

        return () => {
            reference.removeEventListener('mouseenter', onMouseEnter);
            reference.removeEventListener('focus', onFocus);
            reference.removeEventListener('mouseleave', onMouseLeave);
            reference.removeEventListener('blur', onBlur);
        };
    }, []);

    // Effect to create/update popper when both nodes are ready and visibility is requested
    useEffect(() => {
        if (isVisible && referenceNode.current && tooltipNode.current && !popperInstance) {
            const instance = createOptimizedPopper(
                referenceNode.current,
                tooltipNode.current,
                options
            );
            setPopperInstance(instance);
        }

        if (popperInstance && isVisible) {
            popperInstance.update();
        }
    }, [isVisible, popperInstance, options]);

    // Cleanup popper on unmount
    useEffect(() => {
        return () => {
            if (popperInstance) {
                popperInstance.destroy();
            }
        };
    }, [popperInstance]);

    return {
        referenceRef,
        tooltipRef,
        isVisible,
        show,
        hide
    };
}
