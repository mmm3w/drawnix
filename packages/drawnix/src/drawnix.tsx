import { Board, BoardChangeData, Wrapper } from '@plait-board/react-board';
import {
  BoardTransforms,
  deleteFragment,
  getSelectedElements,
  PlaitBoard,
  PlaitBoardOptions,
  PlaitElement,
  PlaitPlugin,
  PlaitPointerType,
  PlaitTheme,
  Selection,
  ThemeColorMode,
  Viewport,
} from '@plait/core';
import React, { useState, useRef, useEffect } from 'react';
import {
  BoardCreationMode,
  memorizeLatest,
  setCreationMode,
  withGroup,
} from '@plait/common';
import { ArrowLineShape, BasicShapes, withDraw } from '@plait/draw';
import { MindPointerType, MindThemeColors, withMind } from '@plait/mind';
import MobileDetect from 'mobile-detect';
import { withMindExtend } from './plugins/with-mind-extend';
import { withCommonPlugin } from './plugins/with-common';
import { CreationToolbar } from './components/toolbar/creation-toolbar';
import { ZoomToolbar } from './components/toolbar/zoom-toolbar';
import { PopupToolbar } from './components/toolbar/popup-toolbar/popup-toolbar';
import { AppToolbar } from './components/toolbar/app-toolbar/app-toolbar';
import classNames from 'classnames';
import './styles/index.scss';
import { buildDrawnixHotkeyPlugin } from './plugins/with-hotkey';
import { withFreehand } from './plugins/freehand/with-freehand';
import { ThemeToolbar } from './components/toolbar/theme-toolbar';
import { buildPencilPlugin } from './plugins/with-pencil';
import {
  DrawnixBoard,
  DrawnixContext,
  DrawnixPointerType,
  DrawnixState,
} from './hooks/use-drawnix';
import { ClosePencilToolbar } from './components/toolbar/pencil-mode-toolbar';
import { TTDDialog } from './components/ttd-dialog/ttd-dialog';
import { CleanConfirm } from './components/clean-confirm/clean-confirm';
import { buildTextLinkPlugin } from './plugins/with-text-link';
import { LinkPopup } from './components/popup/link-popup/link-popup';
import { I18nProvider } from './i18n';
import { Tutorial } from './components/tutorial';
import { LASER_POINTER_CLASS_NAME } from './utils/laser-pointer';
import { Freehand, FreehandShape } from './plugins/freehand/type';
import {
  ERASER_MEMORIZE_KEY,
  FREEHAND_MEMORIZE_KEY,
  getEraserSize,
  getPenSize,
} from './plugins/freehand/utils';

export type DrawnixIframeControlOptions = {
  enabled?: boolean;
  allowedOrigins?: string[];
};

export type DrawnixToolName =
  | 'hand'
  | 'selection'
  | 'mind'
  | 'text'
  | 'pen'
  | 'brush'
  | 'feltTipPen'
  | 'eraser'
  | 'arrow'
  | 'shape'
  | 'rectangle';

export const DRAWNIX_VALUE_CHANGE_MESSAGE_TYPE = 'drawnix:value-change';
export const DRAWNIX_VIEWPORT_CHANGE_MESSAGE_TYPE = 'drawnix:viewport-change';
export const DRAWNIX_SELECTION_STATE_MESSAGE_TYPE = 'drawnix:selection-state';

const DRAWNIX_TRAILING_FLUSH_DELAY = 200;

export type DrawnixValueChangeMessage = {
  type: typeof DRAWNIX_VALUE_CHANGE_MESSAGE_TYPE;
  payload: { children: PlaitElement[] };
  meta?: { senderId?: string };
};

export type DrawnixViewportChangeMessage = {
  type: typeof DRAWNIX_VIEWPORT_CHANGE_MESSAGE_TYPE;
  payload: { viewport: Viewport };
  meta?: { senderId?: string };
};

export type DrawnixSelectionStateMessage = {
  type: typeof DRAWNIX_SELECTION_STATE_MESSAGE_TYPE;
  payload: { hasSelection: boolean };
  meta?: { senderId?: string };
};

export type DrawnixSyncMessage =
  | DrawnixValueChangeMessage
  | DrawnixViewportChangeMessage
  | DrawnixSelectionStateMessage;

const DRAWNIX_SET_TOOL_MESSAGE_TYPES = new Set([
  'drawnix:set-tool',
  'drawnix:setTool',
  'set-tool',
  'setTool',
]);

const DRAWNIX_SET_PEN_COLOR_MESSAGE_TYPES = new Set([
  'drawnix:set-pen-color',
  'drawnix:setPenColor',
  'set-pen-color',
  'setPenColor',
]);

const DRAWNIX_SET_PEN_SIZE_MESSAGE_TYPES = new Set([
  'drawnix:set-pen-size',
  'drawnix:setPenSize',
  'set-pen-size',
  'setPenSize',
]);

const DRAWNIX_SET_ERASER_SIZE_MESSAGE_TYPES = new Set([
  'drawnix:set-eraser-size',
  'drawnix:setEraserSize',
  'set-eraser-size',
  'setEraserSize',
]);

const DRAWNIX_TOOL_POINTER_MAP: Record<string, DrawnixPointerType> = {
  hand: PlaitPointerType.hand,
  selection: PlaitPointerType.selection,
  mind: MindPointerType.mind,
  text: BasicShapes.text,
  pen: FreehandShape.feltTipPen,
  brush: FreehandShape.feltTipPen,
  felttippen: FreehandShape.feltTipPen,
  eraser: FreehandShape.eraser,
  arrow: ArrowLineShape.straight,
  shape: BasicShapes.rectangle,
  rectangle: BasicShapes.rectangle,
};

const isAllowedOrigin = (origin: string, allowedOrigins: string[]) => {
  if (allowedOrigins.length === 0) {
    return true;
  }
  return allowedOrigins.includes(origin);
};

const getToolFromMessage = (message: Record<string, unknown>) => {
  if (typeof message.tool === 'string') {
    return message.tool;
  }
  if (
    message.payload &&
    typeof message.payload === 'object' &&
    typeof (message.payload as Record<string, unknown>).tool === 'string'
  ) {
    return (message.payload as Record<string, string>).tool;
  }
  return null;
};

const getPenColorFromMessage = (message: Record<string, unknown>) => {
  if (typeof message.color === 'string') {
    return message.color;
  }
  if (
    message.payload &&
    typeof message.payload === 'object' &&
    typeof (message.payload as Record<string, unknown>).color === 'string'
  ) {
    return (message.payload as Record<string, string>).color;
  }
  return null;
};

const getPenSizeFromMessage = (message: Record<string, unknown>) => {
  if (typeof message.size === 'number') {
    return message.size;
  }
  if (typeof message.width === 'number') {
    return message.width;
  }
  if (typeof message.strokeWidth === 'number') {
    return message.strokeWidth;
  }
  if (message.payload && typeof message.payload === 'object') {
    const payload = message.payload as Record<string, unknown>;
    if (typeof payload.size === 'number') {
      return payload.size;
    }
    if (typeof payload.width === 'number') {
      return payload.width;
    }
    if (typeof payload.strokeWidth === 'number') {
      return payload.strokeWidth;
    }
  }
  return null;
};

const parseIncomingMessage = (rawData: unknown): Record<string, unknown> | null => {
  if (!rawData) {
    return null;
  }
  if (typeof rawData === 'object') {
    // Some bridge layers wrap message as { data: ... }.
    const record = rawData as Record<string, unknown>;
    if (record.data !== undefined) {
      const nested = parseIncomingMessage(record.data);
      if (nested) {
        return nested;
      }
    }
    return record;
  }
  if (typeof rawData === 'string') {
    try {
      const parsed = JSON.parse(rawData) as unknown;
      return parseIncomingMessage(parsed);
    } catch {
      return null;
    }
  }
  return null;
};

const cloneSerializableData = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

const getSyncTargetOrigin = (
  iframeControl: DrawnixIframeControlOptions | undefined
) => {
  if ((iframeControl?.allowedOrigins?.length ?? 0) === 1) {
    return iframeControl?.allowedOrigins?.[0] ?? '*';
  }
  return '*';
};

const createSyncSenderId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `drawnix-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const setEraserCursorSize = (board: PlaitBoard, size: number) => {
  const canUseCustomCursor =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const boardContainer = PlaitBoard.getBoardContainer(board) as HTMLElement;
  if (!canUseCustomCursor) {
    boardContainer.style.removeProperty('--drawnix-eraser-cursor');
    return;
  }
  const radius = Math.max(1, Math.min(200, size));
  const strokeWidth = 1.5;
  const padding = 2;
  const svgSize = Math.ceil(radius * 2 + strokeWidth * 2 + padding * 2);
  const center = svgSize / 2;
  const hotspot = Math.floor(center);
  const svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#666" stroke-width="${strokeWidth}"/></svg>`;
  const encoded = window.btoa(svg);
  boardContainer.style.setProperty(
    '--drawnix-eraser-cursor',
    `url("data:image/svg+xml;base64,${encoded}") ${hotspot} ${hotspot}`
  );
};

const setPenCursorSize = (board: PlaitBoard, size: number) => {
  const canUseCustomCursor =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const boardContainer = PlaitBoard.getBoardContainer(board) as HTMLElement;
  if (!canUseCustomCursor) {
    boardContainer.style.removeProperty('--drawnix-pen-cursor');
    return;
  }
  const normalizedSize = Math.max(1, Math.min(200, size));
  const strokeWidth = 1.5;
  // Pen size maps to stroke width, so cursor diameter should match it.
  const radius = Math.max(1, normalizedSize / 2 - strokeWidth / 2);
  const padding = 2;
  const svgSize = Math.ceil(radius * 2 + strokeWidth * 2 + padding * 2);
  const center = svgSize / 2;
  const hotspot = Math.floor(center);
  const svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#666" stroke-width="${strokeWidth}"/></svg>`;
  const encoded = window.btoa(svg);
  boardContainer.style.setProperty(
    '--drawnix-pen-cursor',
    `url("data:image/svg+xml;base64,${encoded}") ${hotspot} ${hotspot}`
  );
};

export type DrawnixProps = {
  value: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
  onChange?: (value: BoardChangeData) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  onValueChange?: (value: PlaitElement[]) => void;
  onViewportChange?: (value: Viewport) => void;
  onThemeChange?: (value: ThemeColorMode) => void;
  afterInit?: (board: PlaitBoard) => void;
  tutorial?: boolean;
  embedded?: boolean;
  iframeControl?: DrawnixIframeControlOptions;
  hidePopupToolbar?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const Drawnix: React.FC<DrawnixProps> = ({
  value,
  viewport,
  theme,
  onChange,
  onSelectionChange,
  onViewportChange,
  onThemeChange,
  onValueChange,
  afterInit,
  tutorial = false,
  embedded = false,
  iframeControl,
  hidePopupToolbar = false,
}) => {
  const options: PlaitBoardOptions = {
    readonly: false,
    hideScrollbar: false,
    disabledScrollOnNonFocus: false,
    themeColors: MindThemeColors,
  };

  const [appState, setAppState] = useState<DrawnixState>(() => {
    // TODO: need to consider how to maintenance the pointer state in future
    const md = new MobileDetect(window.navigator.userAgent);
    return {
      pointer: PlaitPointerType.hand,
      isMobile: md.mobile() !== null,
      isPencilMode: false,
      openDialogType: null,
      openCleanConfirm: false,
    };
  });

  const [board, setBoard] = useState<DrawnixBoard | null>(null);
  const boardRef = useRef<DrawnixBoard | null>(null);

  if (board) {
    board.appState = appState;
  }
  boardRef.current = board;

  const updateAppState = (newAppState: Partial<DrawnixState>) => {
    setAppState((currentAppState) => ({
      ...currentAppState,
      ...newAppState,
    }));
  };

  const iframeControlEnabled = iframeControl?.enabled ?? embedded;
  const syncSenderIdRef = useRef<string>(createSyncSenderId());
  const pendingValueRef = useRef<PlaitElement[] | null>(null);
  const pendingViewportRef = useRef<Viewport | null>(null);
  const trailingFlushTimerRef = useRef<number | null>(null);
  const lastSelectionStateRef = useRef<boolean | null>(null);

  const postSyncMessage = (message: DrawnixSyncMessage) => {
    const messageWithMeta = {
      ...message,
      meta: {
        ...(message.meta || {}),
        senderId: syncSenderIdRef.current,
      },
    };
    const reactNativeWebView = (window as unknown as {
      ReactNativeWebView?: { postMessage?: (message: string) => void };
    }).ReactNativeWebView;
    if (
      reactNativeWebView &&
      typeof reactNativeWebView.postMessage === 'function'
    ) {
      reactNativeWebView.postMessage(JSON.stringify(messageWithMeta));
      return;
    }
    if (window.parent !== window) {
      window.parent.postMessage(
        messageWithMeta,
        getSyncTargetOrigin(iframeControl)
      );
      return;
    }
    window.postMessage(messageWithMeta, window.location.origin);
  };

  const clearTrailingFlushTimer = () => {
    if (trailingFlushTimerRef.current !== null) {
      window.clearTimeout(trailingFlushTimerRef.current);
      trailingFlushTimerRef.current = null;
    }
  };

  const flushPendingChanges = () => {
    clearTrailingFlushTimer();
    if (!iframeControlEnabled) {
      pendingValueRef.current = null;
      pendingViewportRef.current = null;
      return;
    }
    if (pendingValueRef.current) {
      postSyncMessage({
        type: DRAWNIX_VALUE_CHANGE_MESSAGE_TYPE,
        payload: { children: pendingValueRef.current },
      });
      pendingValueRef.current = null;
    }
    if (pendingViewportRef.current) {
      postSyncMessage({
        type: DRAWNIX_VIEWPORT_CHANGE_MESSAGE_TYPE,
        payload: { viewport: pendingViewportRef.current },
      });
      pendingViewportRef.current = null;
    }
  };

  const scheduleTrailingFlush = () => {
    clearTrailingFlushTimer();
    trailingFlushTimerRef.current = window.setTimeout(() => {
      flushPendingChanges();
    }, DRAWNIX_TRAILING_FLUSH_DELAY);
  };

  useEffect(() => {
    if (!iframeControlEnabled || !board) {
      return;
    }
    const allowedOrigins = iframeControl?.allowedOrigins ?? [];
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isAllowedOrigin(event.origin, allowedOrigins)) {
        return;
      }
      if (window.parent !== window && event.source !== window.parent) {
        return;
      }
      const message = parseIncomingMessage(event.data);
      if (!message) {
        return;
      }
      const messageMeta =
        message.meta && typeof message.meta === 'object'
          ? (message.meta as Record<string, unknown>)
          : null;
      const senderId =
        messageMeta && typeof messageMeta.senderId === 'string'
          ? messageMeta.senderId
          : null;
      if (senderId && senderId === syncSenderIdRef.current) {
        return;
      }
      if (typeof message.type !== 'string') {
        return;
      }
      if (message.type === DRAWNIX_VALUE_CHANGE_MESSAGE_TYPE) {
        const payload =
          message.payload && typeof message.payload === 'object'
            ? (message.payload as Record<string, unknown>)
            : null;
        if (!payload || !Array.isArray(payload.children)) {
          return;
        }
        const nextChildren = payload.children as PlaitElement[];
        onValueChange && onValueChange(cloneSerializableData(nextChildren));
        onChange &&
          onChange({
            children: cloneSerializableData(nextChildren),
            operations: [],
            viewport: board.viewport,
            selection: board.selection,
            theme: board.theme,
          });
        return;
      }
      if (message.type === DRAWNIX_VIEWPORT_CHANGE_MESSAGE_TYPE) {
        const payload =
          message.payload && typeof message.payload === 'object'
            ? (message.payload as Record<string, unknown>)
            : null;
        if (!payload || !payload.viewport || typeof payload.viewport !== 'object') {
          return;
        }
        const nextViewport = payload.viewport as Viewport;
        onViewportChange && onViewportChange(cloneSerializableData(nextViewport));
        onChange &&
          onChange({
            children: board.children,
            operations: [],
            viewport: cloneSerializableData(nextViewport),
            selection: board.selection,
            theme: board.theme,
          });
        return;
      }
      if (DRAWNIX_SET_TOOL_MESSAGE_TYPES.has(message.type)) {
        const tool = getToolFromMessage(message);
        if (!tool) {
          return;
        }
        const pointer = DRAWNIX_TOOL_POINTER_MAP[tool.toLowerCase()];
        if (!pointer) {
          return;
        }
        setCreationMode(board, BoardCreationMode.drawing);
        BoardTransforms.updatePointerType(board, pointer);
        updateAppState({ pointer });
        return;
      }
      if (DRAWNIX_SET_PEN_COLOR_MESSAGE_TYPES.has(message.type)) {
        const color = getPenColorFromMessage(message);
        if (!color) {
          return;
        }
        memorizeLatest<Freehand>(FREEHAND_MEMORIZE_KEY, 'strokeColor', color);
        return;
      }
      if (DRAWNIX_SET_PEN_SIZE_MESSAGE_TYPES.has(message.type)) {
        const size = getPenSizeFromMessage(message);
        if (typeof size !== 'number' || Number.isNaN(size)) {
          return;
        }
        const normalizedSize = Math.max(1, Math.min(200, size));
        memorizeLatest<Freehand>(
          FREEHAND_MEMORIZE_KEY,
          'strokeWidth',
          normalizedSize
        );
        setPenCursorSize(board, normalizedSize);
        return;
      }
      if (DRAWNIX_SET_ERASER_SIZE_MESSAGE_TYPES.has(message.type)) {
        const size = getPenSizeFromMessage(message);
        if (typeof size !== 'number' || Number.isNaN(size)) {
          return;
        }
        const normalizedSize = Math.max(1, Math.min(200, size));
        memorizeLatest(
          ERASER_MEMORIZE_KEY,
          'eraserSize' as any,
          normalizedSize as any
        );
        setEraserCursorSize(board, normalizedSize);
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [board, iframeControlEnabled, iframeControl?.allowedOrigins]);

  useEffect(() => {
    if (!board) {
      return;
    }
    if (appState.pointer === FreehandShape.feltTipPen) {
      setPenCursorSize(board, getPenSize());
    }
    if (appState.pointer === FreehandShape.eraser) {
      setEraserCursorSize(board, getEraserSize());
    }
  }, [board, appState.pointer]);

  useEffect(() => {
    const onPointerEnd = () => {
      flushPendingChanges();
    };
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [iframeControlEnabled, iframeControl?.allowedOrigins]);

  useEffect(() => {
    return () => {
      clearTrailingFlushTimer();
    };
  }, []);

  useEffect(() => {
    if (!iframeControlEnabled || !board) {
      return;
    }
    const hasSelection = getSelectedElements(board).length > 0;
    lastSelectionStateRef.current = hasSelection;
    postSyncMessage({
      type: DRAWNIX_SELECTION_STATE_MESSAGE_TYPE,
      payload: { hasSelection },
    });
  }, [board, iframeControlEnabled]);

  const plugins: PlaitPlugin[] = [
    withDraw,
    withGroup,
    withMind,
    withMindExtend,
    withCommonPlugin,
    buildDrawnixHotkeyPlugin(updateAppState),
    withFreehand,
    buildPencilPlugin(updateAppState),
    buildTextLinkPlugin(updateAppState),
  ];

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <I18nProvider>
      <DrawnixContext.Provider value={{ appState, setAppState }}>
        <div
          className={classNames('drawnix', {
            'drawnix--mobile': appState.isMobile,
          })}
          ref={containerRef}
        >
          <Wrapper
            value={value}
            viewport={viewport}
            theme={theme}
            options={options}
            plugins={plugins}
            onChange={(data: BoardChangeData) => {
              onChange && onChange(data);
            }}
            onSelectionChange={(selection) => {
              onSelectionChange && onSelectionChange(selection);
              const currentBoard = boardRef.current;
              if (!iframeControlEnabled || !currentBoard) {
                return;
              }
              const hasSelection = getSelectedElements(currentBoard).length > 0;
              if (lastSelectionStateRef.current === hasSelection) {
                return;
              }
              lastSelectionStateRef.current = hasSelection;
              postSyncMessage({
                type: DRAWNIX_SELECTION_STATE_MESSAGE_TYPE,
                payload: { hasSelection },
              });
            }}
            onViewportChange={(nextViewport) => {
              onViewportChange && onViewportChange(nextViewport);
              if (!iframeControlEnabled) {
                return;
              }
              pendingViewportRef.current = cloneSerializableData(nextViewport);
              scheduleTrailingFlush();
            }}
            onThemeChange={onThemeChange}
            onValueChange={(nextValue) => {
              onValueChange && onValueChange(nextValue);
              if (!iframeControlEnabled) {
                return;
              }
              pendingValueRef.current = cloneSerializableData(nextValue);
              scheduleTrailingFlush();
            }}
          >
            <Board
              afterInit={(board) => {
                boardRef.current = board as DrawnixBoard;
                setBoard(board as DrawnixBoard);
                afterInit && afterInit(board);
              }}
            >
              {!embedded &&
                tutorial &&
                board &&
                PlaitBoard.isPointer(board, PlaitPointerType.selection) && (
                  <Tutorial />
                )}
            </Board>
            {!embedded && (
              <>
                <AppToolbar></AppToolbar>
                <CreationToolbar></CreationToolbar>
                <ZoomToolbar></ZoomToolbar>
                <ThemeToolbar></ThemeToolbar>
                {!hidePopupToolbar && <PopupToolbar></PopupToolbar>}
                <LinkPopup></LinkPopup>
                <ClosePencilToolbar></ClosePencilToolbar>
                <TTDDialog container={containerRef.current}></TTDDialog>
                <CleanConfirm container={containerRef.current}></CleanConfirm>
              </>
            )}
          </Wrapper>
          <canvas className={`${LASER_POINTER_CLASS_NAME} mouse-course-hidden`}></canvas>
        </div>
      </DrawnixContext.Provider>
    </I18nProvider>
  );
};
