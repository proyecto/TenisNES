import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardControls } from './useKeyboardControls';

describe('useKeyboardControls Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Dispatch blur to clear any pressed state
    window.dispatchEvent(new Event('blur'));
  });

  it('initializes with all keys unpressed', () => {
    const { result } = renderHook(() => useKeyboardControls());
    expect(result.current.current).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
      action: false,
      lob: false,
    });
  });

  it('updates directional movement on WASD keys', () => {
    const { result } = renderHook(() => useKeyboardControls());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
    });
    expect(result.current.current.forward).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }));
    });
    expect(result.current.current.left).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
    });
    expect(result.current.current.forward).toBe(false);
    expect(result.current.current.left).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }));
    });
    expect(result.current.current.backward).toBe(true);
    expect(result.current.current.right).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', key: 's' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd' }));
    });
    expect(result.current.current.left).toBe(false);
    expect(result.current.current.backward).toBe(false);
    expect(result.current.current.right).toBe(false);
  });

  it('updates directional movement on Arrow keys and prevents default scrolling', () => {
    const { result } = renderHook(() => useKeyboardControls());

    const preventDefaultSpy = vi.fn();
    const upEvent = new KeyboardEvent('keydown', { code: 'ArrowUp', key: 'ArrowUp' });
    Object.defineProperty(upEvent, 'preventDefault', { value: preventDefaultSpy });

    act(() => {
      window.dispatchEvent(upEvent);
    });
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(result.current.current.forward).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', key: 'ArrowUp' }));
    });
    expect(result.current.current.forward).toBe(false);
  });

  it('updates action key on Space and mouse pointer down/up', () => {
    const { result } = renderHook(() => useKeyboardControls());

    // Space key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    });
    expect(result.current.current.action).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
    });
    expect(result.current.current.action).toBe(false);

    // Left Mouse Click (button 0)
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    });
    expect(result.current.current.action).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { button: 0 }));
    });
    expect(result.current.current.action).toBe(false);
  });

  it('updates lob key on Shift, E, X and Right Mouse click', () => {
    const { result } = renderHook(() => useKeyboardControls());

    // Shift key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));
    });
    expect(result.current.current.lob).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift' }));
    });
    expect(result.current.current.lob).toBe(false);

    // E key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
    });
    expect(result.current.current.lob).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e' }));
    });
    expect(result.current.current.lob).toBe(false);

    // Right Mouse Click (button 2)
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerdown', { button: 2 }));
    });
    expect(result.current.current.lob).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { button: 2 }));
    });
    expect(result.current.current.lob).toBe(false);
  });

  it('resets all keys to false when window loses focus (blur)', () => {
    const { result } = renderHook(() => useKeyboardControls());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));
    });
    expect(result.current.current.forward).toBe(true);
    expect(result.current.current.action).toBe(true);
    expect(result.current.current.lob).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current.current).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
      action: false,
      lob: false,
    });
  });

  it('prevents default context menu on right click', () => {
    renderHook(() => useKeyboardControls());

    const preventDefaultSpy = vi.fn();
    const contextMenuEvent = new MouseEvent('contextmenu');
    Object.defineProperty(contextMenuEvent, 'preventDefault', { value: preventDefaultSpy });

    act(() => {
      window.dispatchEvent(contextMenuEvent);
    });
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
