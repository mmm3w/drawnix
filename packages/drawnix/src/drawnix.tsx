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
import { saveAsImage } from './utils';

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

export const DRAWNIX_LOADED_MESSAGE_TYPE = 'drawnix:loaded';
export const DRAWNIX_DELETE_SELECTION_MESSAGE_TYPE = 'drawnix:delete-selection';
export const DRAWNIX_CLEAR_BOARD_MESSAGE_TYPE = 'drawnix:clear-board';
export const DRAWNIX_EXPORT_IMAGE_REQUEST_MESSAGE_TYPE =
  'drawnix:export-image-request';
export const DRAWNIX_CHANGE_MESSAGE_TYPE = 'drawnix:change';
export const DRAWNIX_UPDATE_DATA_MESSAGE_TYPE = 'drawnix:update-data';

export type DrawnixLoadedMessage = {
  type: typeof DRAWNIX_LOADED_MESSAGE_TYPE;
  payload: { loaded: true };
  meta?: { senderId?: string };
};

export type DrawnixChangeMessage = {
  type: typeof DRAWNIX_CHANGE_MESSAGE_TYPE;
  payload: Pick<BoardChangeData, 'children' | 'viewport'>;
  meta?: { senderId?: string };
};

export type DrawnixUpdateDataMessage = {
  type: typeof DRAWNIX_UPDATE_DATA_MESSAGE_TYPE;
  payload: {
    children?: PlaitElement[];
    viewport?: Viewport;
  };
  meta?: { senderId?: string };
};

export type DrawnixSyncMessage = DrawnixLoadedMessage | DrawnixChangeMessage | DrawnixUpdateDataMessage;

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

const DRAWNIX_SET_DISABLED_MESSAGE_TYPES = new Set([
  'drawnix:set-disabled',
  'drawnix:setDisabled',
  'set-disabled',
  'setDisabled',
]);

const DRAWNIX_EXPORT_IMAGE_REQUEST_MESSAGE_TYPES = new Set([
  DRAWNIX_EXPORT_IMAGE_REQUEST_MESSAGE_TYPE,
  'drawnix:export-image',
  'drawnix:exportImage',
  'export-image',
  'exportImage',
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

const getDisabledFromMessage = (message: Record<string, unknown>) => {
  if (typeof message.disabled === 'boolean') {
    return message.disabled;
  }
  if (typeof message.readonly === 'boolean') {
    return message.readonly;
  }
  if (typeof message.enabled === 'boolean') {
    return !message.enabled;
  }
  if (message.payload && typeof message.payload === 'object') {
    const payload = message.payload as Record<string, unknown>;
    if (typeof payload.disabled === 'boolean') {
      return payload.disabled;
    }
    if (typeof payload.readonly === 'boolean') {
      return payload.readonly;
    }
    if (typeof payload.enabled === 'boolean') {
      return !payload.enabled;
    }
  }
  return null;
};

const getExportImageTransparentFromMessage = (
  message: Record<string, unknown>
) => {
  if (typeof message.transparent === 'boolean') {
    return message.transparent;
  }
  if (typeof message.isTransparent === 'boolean') {
    return message.isTransparent;
  }
  if (typeof message.format === 'string') {
    return message.format.toLowerCase() !== 'jpg';
  }
  if (message.payload && typeof message.payload === 'object') {
    const payload = message.payload as Record<string, unknown>;
    if (typeof payload.transparent === 'boolean') {
      return payload.transparent;
    }
    if (typeof payload.isTransparent === 'boolean') {
      return payload.isTransparent;
    }
    if (typeof payload.format === 'string') {
      return payload.format.toLowerCase() !== 'jpg';
    }
  }
  // Default to png/transparent to match existing toolbar behavior.
  return true;
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
  disabled?: boolean;
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
  disabled = false,
  tutorial = false,
  embedded = false,
  iframeControl,
  hidePopupToolbar = false,
}) => {
  const [runtimeDisabled, setRuntimeDisabled] = useState(disabled);
  const options: PlaitBoardOptions = {
    readonly: runtimeDisabled,
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

  // State for external data updates
  const [externalValue, setExternalValue] = useState<PlaitElement[] | undefined>(undefined);
  const [externalViewport, setExternalViewport] = useState<Viewport | undefined>(undefined);

  // Merge external data with props
  const mergedValue = externalValue ?? value;
  const mergedViewport = externalViewport ?? viewport;

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

  // Refs for debouncing change events
  const lastSentDataRef = useRef<{ children: PlaitElement[]; viewport: Viewport } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<{ children: PlaitElement[]; viewport: Viewport } | null>(null);
  const DEBOUNCE_DELAY = 200; // ms

  const postSyncMessage = (message: DrawnixSyncMessage) => {
    console.log('postSyncMessage', message);
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
      if (message.type === DRAWNIX_DELETE_SELECTION_MESSAGE_TYPE) {
        const selectedElements = getSelectedElements(board);
        if (selectedElements.length > 0) {
          deleteFragment(board);
        }
        return;
      }
      if (message.type === DRAWNIX_CLEAR_BOARD_MESSAGE_TYPE) {
        board.deleteFragment(board.children);
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
        return;
      }
      if (DRAWNIX_SET_DISABLED_MESSAGE_TYPES.has(message.type)) {
        const nextDisabled = getDisabledFromMessage(message);
        if (typeof nextDisabled !== 'boolean') {
          return;
        }
        setRuntimeDisabled(nextDisabled);
        return;
      }
      if (DRAWNIX_EXPORT_IMAGE_REQUEST_MESSAGE_TYPES.has(message.type)) {
        const isTransparent = getExportImageTransparentFromMessage(message);
        saveAsImage(board, isTransparent);
        return;
      }
      if (message.type === DRAWNIX_UPDATE_DATA_MESSAGE_TYPE) {
        const updateMessage = message as DrawnixUpdateDataMessage;
        const { children: newChildren, viewport: newViewport } = updateMessage.payload;
        if (newChildren !== undefined) {
          setExternalValue(newChildren);
        }
        if (newViewport !== undefined) {
          setExternalViewport(newViewport);
        }
        return;
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [board, iframeControlEnabled, iframeControl?.allowedOrigins]);

  useEffect(() => {
    setRuntimeDisabled(disabled);
  }, [disabled]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!board) {
      return;
    }
    board.options = {
      ...board.options,
      readonly: runtimeDisabled,
    };
  }, [board, runtimeDisabled]);

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

  const containerRef = useRef<HTMLDivElement|null>(null);

  return (
    <I18nProvider>
      <DrawnixContext.Provider value={{ appState, setAppState }}>
        <div
          className={classNames('drawnix', {
            'drawnix--mobile': appState.isMobile,
            'drawnix--disabled': runtimeDisabled,
          })}
          ref={containerRef}
        >
          <Wrapper
            value={mergedValue}
            viewport={mergedViewport}
            theme={theme}
            options={options}
            plugins={plugins}
            onChange={(data: BoardChangeData) => {
              onChange && onChange(data);
              if (iframeControlEnabled) {
                const currentData = {
                  children: data.children,
                  viewport: data.viewport,
                };

                // Check if data actually changed
                const lastSent = lastSentDataRef.current;
                const isChildrenEqual = lastSent && JSON.stringify(lastSent.children) === JSON.stringify(currentData.children);
                const isViewportEqual = lastSent && JSON.stringify(lastSent.viewport) === JSON.stringify(currentData.viewport);

                if (isChildrenEqual && isViewportEqual) {
                  return; // No change, skip sending
                }

                // Store as pending data
                pendingDataRef.current = currentData;

                // Clear existing timer
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }

                // Set new timer to send data after delay
                debounceTimerRef.current = setTimeout(() => {
                  const pending = pendingDataRef.current;
                  if (pending) {
                    postSyncMessage({
                      type: DRAWNIX_CHANGE_MESSAGE_TYPE,
                      payload: cloneSerializableData(pending),
                    });
                    lastSentDataRef.current = pending;
                    pendingDataRef.current = null;
                  }
                }, DEBOUNCE_DELAY);
              }
            }}
            onSelectionChange={onSelectionChange}
            onViewportChange={onViewportChange}
            onThemeChange={onThemeChange}
            onValueChange={onValueChange}
          >
            <Board
              afterInit={(board) => {
                boardRef.current = board as DrawnixBoard;
                (board as DrawnixBoard).options = {
                  ...(board as DrawnixBoard).options,
                  readonly: runtimeDisabled,
                };
                setBoard(board as DrawnixBoard);
                if (iframeControlEnabled) {
                  postSyncMessage({
                    type: DRAWNIX_LOADED_MESSAGE_TYPE,
                    payload: { loaded: true },
                  });
                }
                afterInit && afterInit(board);
              }}
            />
            {!embedded && !runtimeDisabled && (
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
