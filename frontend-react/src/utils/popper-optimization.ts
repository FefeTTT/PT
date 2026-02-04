
import { createPopper, Instance, Options, State } from '@popperjs/core';

export interface OptimizedPopperOptions extends Partial<Options> {
    gpuAcceleration?: boolean;
}

/**
 * Creates a performance-optimized Popper instance.
 * 
 * Enforces 'fixed' strategy and GPU acceleration to minimize layout thrashing.
 * Batches initial updates using requestAnimationFrame.
 * 
 * @param reference - The reference element (e.g., button).
 * @param tooltip - The tooltip/popover element.
 * @param options - Custom Popper options.
 * @returns The Popper instance with a throttled update method.
 */
export function createOptimizedPopper(
    reference: HTMLElement,
    tooltip: HTMLElement,
    options: OptimizedPopperOptions = {}
): Instance {
    const { gpuAcceleration = true, ...popperOptions } = options;

    const instance = createPopper(reference, tooltip, {
        ...popperOptions,
        strategy: 'fixed', // Force fixed positioning
        modifiers: [
            ...(popperOptions.modifiers || []),
            {
                name: 'computeStyles',
                options: {
                    gpuAcceleration, // Ensure GPU acceleration is used
                    adaptive: false, // Turn off adaptive for predictability
                },
            },
            {
                name: 'eventListeners',
                options: {
                    scroll: false, // Disable default scroll listeners if managed manually or not needed
                    resize: true,
                },
            },
        ],
    });

    // Throttled update wrapper
    const originalUpdate = instance.update;
    let updateScheduled = false;

    instance.update = () => {
        return new Promise<Partial<State>>((resolve) => {
            if (updateScheduled) {
                resolve(instance.state); // Return current state if pending
                return;
            }

            updateScheduled = true;
            requestAnimationFrame(() => {
                originalUpdate().then((state) => {
                    updateScheduled = false;
                    resolve(state);
                });
            });
        });
    };

    // Initial batch update
    requestAnimationFrame(() => {
        instance.update();
    });

    return instance;
}
