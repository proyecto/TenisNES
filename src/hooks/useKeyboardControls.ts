/**
 * @file useKeyboardControls.ts
 * @description Input mapping hook for keyboard and pointer events in the tennis simulation.
 * Maps WASD / Arrow keys to directional movement, and Space / Shift / Mouse clicks to shot actions.
 */

import { useEffect, useRef } from 'react';

/**
 * Snapshot of current input states.
 */
export interface KeyboardState {
  /** Move forward (upwards along court toward net): W or Arrow Up */
  forward: boolean;
  /** Move backward (downwards along court toward baseline): S or Arrow Down */
  backward: boolean;
  /** Move left: A or Arrow Left */
  left: boolean;
  /** Move right: D or Arrow Right */
  right: boolean;
  /** Primary action / strike / serve toss: Spacebar or Left Mouse Button */
  action: boolean;
  /** High defensive lob stroke: Shift, E, X, or Right Mouse Button */
  lob: boolean;
}

/**
 * React hook that captures and tracks user input state without triggering re-renders,
 * providing a high-performance ref for 60 FPS animation loops.
 *
 * @returns Mutable ref containing current keyboard and pointer flags.
 */
export const useKeyboardControls = () => {
  const keys = useRef<KeyboardState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    action: false,
    lob: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default scroll for arrows and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      const code = e.code || '';
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
        keys.current.forward = true;
      }
      if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
        keys.current.backward = true;
      }
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
        keys.current.left = true;
      }
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
        keys.current.right = true;
      }
      if (code === 'Space' || key === ' ' || key === 'spacebar') {
        keys.current.action = true;
      }
      if (
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        code === 'KeyE' ||
        code === 'KeyX' ||
        key === 'shift' ||
        key === 'e' ||
        key === 'x'
      ) {
        keys.current.lob = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code || '';
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
        keys.current.forward = false;
      }
      if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
        keys.current.backward = false;
      }
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
        keys.current.left = false;
      }
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
        keys.current.right = false;
      }
      if (code === 'Space' || key === ' ' || key === 'spacebar') {
        keys.current.action = false;
      }
      if (
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        code === 'KeyE' ||
        code === 'KeyX' ||
        key === 'shift' ||
        key === 'e' ||
        key === 'x'
      ) {
        keys.current.lob = false;
      }
    };

    const handleBlur = () => {
      keys.current.forward = false;
      keys.current.backward = false;
      keys.current.left = false;
      keys.current.right = false;
      keys.current.action = false;
      keys.current.lob = false;
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (e.button === 0) {
        keys.current.action = true;
      } else if (e.button === 2) {
        keys.current.lob = true;
      }
    };

    const handlePointerUp = (e: MouseEvent) => {
      if (e.button === 0) {
        keys.current.action = false;
      } else if (e.button === 2) {
        keys.current.lob = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return keys;
};
