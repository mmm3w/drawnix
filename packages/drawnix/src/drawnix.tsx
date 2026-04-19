import { Board, BoardChangeData, Wrapper } from '@plait-board/react-board';
import {
  BoardTransforms,
  clearViewportOrigination,
  deleteFragment,
  getSelectedElements,
  PlaitBoard,
  PlaitBoardOptions,
  PlaitElement,
  PlaitOperation,
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
import { ArrowLineShape, BasicShapes, DrawTransforms, withDraw } from '@plait/draw';
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
export const DRAWNIX_SET_VALUE_MESSAGE_TYPE = 'drawnix:set-value';
export const DRAWNIX_ADD_IMAGE_MESSAGE_TYPE = 'drawnix:add-image';

export type DrawnixLoadedMessage = {
  type: typeof DRAWNIX_LOADED_MESSAGE_TYPE;
  payload: { loaded: true };
  meta?: { senderId?: string };
};

export type DrawnixChangeMessage = {
  type: typeof DRAWNIX_CHANGE_MESSAGE_TYPE;
  payload: {
    children: PlaitElement[];
    operations: PlaitOperation[];
    viewport: Viewport;
    selection: Selection | null;
    senderContainerSize?: { width: number; height: number };
  };
  meta?: { senderId?: string };
};

export type DrawnixSetValueMessage = {
  type: typeof DRAWNIX_SET_VALUE_MESSAGE_TYPE;
  payload: {
    children?: PlaitElement[];
    viewport?: Viewport;
    senderContainerSize?: { width: number; height: number };
  };
  meta?: { senderId?: string };
};

export type DrawnixAddImageMessage = {
  type: typeof DRAWNIX_ADD_IMAGE_MESSAGE_TYPE;
  payload: {
    imageUrl: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
  meta?: { senderId?: string };
};

export type DrawnixSyncMessage = DrawnixLoadedMessage | DrawnixChangeMessage | DrawnixSetValueMessage | DrawnixAddImageMessage;

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

const DRAWNIX_ADD_IMAGE_MESSAGE_TYPES = new Set([
  DRAWNIX_ADD_IMAGE_MESSAGE_TYPE,
  'drawnix:addImage',
  'add-image',
  'addImage',
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

const getImageFromMessage = (message: Record<string, unknown>) => {
  const result: {
    imageUrl?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  } = {};

  // Check top-level properties
  if (typeof message.imageUrl === 'string') {
    result.imageUrl = message.imageUrl;
  }
  if (typeof message.url === 'string') {
    result.imageUrl = message.url;
  }
  if (typeof message.src === 'string') {
    result.imageUrl = message.src;
  }
  if (typeof message.width === 'number') {
    result.width = message.width;
  }
  if (typeof message.height === 'number') {
    result.height = message.height;
  }
  if (typeof message.x === 'number') {
    result.x = message.x;
  }
  if (typeof message.y === 'number') {
    result.y = message.y;
  }

  // Check payload properties
  if (message.payload && typeof message.payload === 'object') {
    const payload = message.payload as Record<string, unknown>;
    if (typeof payload.imageUrl === 'string') {
      result.imageUrl = payload.imageUrl;
    }
    if (typeof payload.url === 'string') {
      result.imageUrl = payload.url;
    }
    if (typeof payload.src === 'string') {
      result.imageUrl = payload.src;
    }
    if (typeof payload.width === 'number') {
      result.width = payload.width;
    }
    if (typeof payload.height === 'number') {
      result.height = payload.height;
    }
    if (typeof payload.x === 'number') {
      result.x = payload.x;
    }
    if (typeof payload.y === 'number') {
      result.y = payload.y;
    }
  }

  return result;
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

  // State for external data updates (e.g., full-value sync)
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
  const lastSentDataRef = useRef<{
    children: PlaitElement[];
    operations: PlaitOperation[];
    viewport: Viewport;
    selection: Selection | null;
  } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<{
    children: PlaitElement[];
    operations: PlaitOperation[];
    viewport: Viewport;
    selection: Selection | null;
  } | null>(null);
  const remoteOperationsRef = useRef<WeakSet<PlaitOperation>>(new WeakSet());
  const DEBOUNCE_DELAY = 200; // ms

  // 判断是否为 set_node 操作
  const isSetNodeOperation = (op: PlaitOperation): boolean => {
    return (op as any).type === 'set_node';
  };

  // 获取操作的 Path（用于 set_node）
  const getOperationPath = (op: PlaitOperation): string | null => {
    const path = (op as any).path;
    if (path && Array.isArray(path)) {
      return path.join(',');
    }
    return null;
  };

  // 合并 operations，set_viewport 和 set_node 类型合并 properties 和 newProperties
  const mergeOperations = (
    existingOps: PlaitOperation[],
    newOps: PlaitOperation[]
  ): PlaitOperation[] => {
    // 处理 set_viewport 类型
    const newSetViewportOps = newOps.filter((op) =>
      PlaitOperation.isSetViewportOperation(op)
    );

    // 处理 set_node 类型，按 Path 分组
    const newSetNodeOps = newOps.filter(isSetNodeOperation);
    const newSetNodePaths = new Set(
      newSetNodeOps.map(getOperationPath).filter(Boolean)
    );

    // 过滤掉需要合并的现有 operations
    const filteredExisting = existingOps.filter((op) => {
      // 过滤 set_viewport
      if (PlaitOperation.isSetViewportOperation(op)) {
        return false;
      }
      // 过滤与新的 set_node 相同 Path 的现有 set_node
      if (isSetNodeOperation(op)) {
        const path = getOperationPath(op);
        if (path && newSetNodePaths.has(path)) {
          return false;
        }
      }
      return true;
    });

    // 合并 set_viewport
    let mergedOps: PlaitOperation[] = [];
    if (newSetViewportOps.length > 0) {
      const existingSetViewportOps = existingOps.filter((op) =>
        PlaitOperation.isSetViewportOperation(op)
      );
      const firstExistingSetViewport = existingSetViewportOps[0];
      const lastNewSetViewport =
        newSetViewportOps[newSetViewportOps.length - 1];

      const mergedSetViewportOp = {
        ...lastNewSetViewport,
        properties: firstExistingSetViewport
          ? (firstExistingSetViewport as any).properties
          : (lastNewSetViewport as any).properties,
        newProperties: (lastNewSetViewport as any).newProperties,
      } as PlaitOperation;

      mergedOps.push(mergedSetViewportOp);
    }

    // 合并 set_node（按 Path 分组处理）
    const setNodeOpsByPath = new Map<string, PlaitOperation[]>();

    // 收集所有相同 Path 的 set_node（包括现有的和新的）
    [...existingOps, ...newOps].forEach((op) => {
      if (isSetNodeOperation(op)) {
        const path = getOperationPath(op);
        if (path) {
          if (!setNodeOpsByPath.has(path)) {
            setNodeOpsByPath.set(path, []);
          }
          setNodeOpsByPath.get(path)!.push(op);
        }
      }
    });

    // 处理每个 Path 的 set_node 合并
    setNodeOpsByPath.forEach((ops, path) => {
      if (ops.length > 0) {
        // 只处理那些在 newOps 中有对应 Path 的情况
        if (newSetNodePaths.has(path)) {
          const firstOp = ops[0];
          const lastOp = ops[ops.length - 1];
          const mergedSetNodeOp = {
            ...lastOp,
            // properties 取第一个的
            properties: (firstOp as any).properties,
            // newProperties 取最后一个的
            newProperties: (lastOp as any).newProperties,
          } as PlaitOperation;
          mergedOps.push(mergedSetNodeOp);
        }
      }
    });

    // 过滤掉新的 operations 中的 set_viewport 和 set_node，然后添加合并后的
    const filteredNewOps = newOps.filter((op) => {
      if (PlaitOperation.isSetViewportOperation(op)) {
        return false;
      }
      if (isSetNodeOperation(op)) {
        return false;
      }
      return true;
    });

    return [...filteredExisting, ...mergedOps, ...filteredNewOps];
  };

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

    const scaleViewport = (
      vp: any,
      senderContainerSize: { width: number; height: number } | undefined
    ): any => {
      if (!vp || vp.zoom == null || !senderContainerSize?.width) {
        return vp;
      }
      const selfRect = PlaitBoard.getBoardContainer(board).getBoundingClientRect();
      const scale = (selfRect.width || 1) / senderContainerSize.width;
      if (!Number.isFinite(scale) || scale <= 0 || scale === 1) {
        return vp;
      }
      const senderSize = senderContainerSize;
      const selfSize = {
        width: selfRect.width || 1,
        height: selfRect.height || 1,
      };
      const zoom = vp.zoom;
      const newZoom = zoom * scale;
      const result = { ...vp, zoom: newZoom };
      const orig = vp.origination;
      if (orig && Array.isArray(orig) && orig.length >= 2) {
        const centerX = orig[0] + senderSize.width / (2 * zoom);
        const centerY = orig[1] + senderSize.height / (2 * zoom);
        const newOrigX = centerX - selfSize.width / (2 * newZoom);
        const newOrigY = centerY - selfSize.height / (2 * newZoom);
        result.origination = [newOrigX, newOrigY];
      }
      return result;
    };

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
      if (message.type === DRAWNIX_CHANGE_MESSAGE_TYPE) {
        const changeMessage = message as DrawnixChangeMessage;
        const { operations, senderContainerSize } = changeMessage.payload;
        if (board && operations && operations.length > 0) {
          let scale = 1;
          if (senderContainerSize?.width) {
            const selfRect = PlaitBoard.getBoardContainer(board).getBoundingClientRect();
            scale = (selfRect.width || 1) / senderContainerSize.width;
            if (!Number.isFinite(scale) || scale <= 0) {
              scale = 1;
            }
          }
          const hasSetViewport = operations.some((op: any) =>
            op.type === 'set_viewport'
          );
          if (hasSetViewport) {
            clearViewportOrigination(board);
          }
          operations.forEach((op: any) => {
            if (op.type === 'set_viewport' && scale !== 1) {
              const scaledOp: any = { ...op };
              if (op.properties) {
                scaledOp.properties = scaleViewport(op.properties, senderContainerSize);
              }
              if (op.newProperties) {
                scaledOp.newProperties = scaleViewport(op.newProperties, senderContainerSize);
              }
              remoteOperationsRef.current.add(scaledOp);
              board.apply(scaledOp);
            } else {
              remoteOperationsRef.current.add(op);
              board.apply(op);
            }
          });
        }
        return;
      }
      if (message.type === DRAWNIX_SET_VALUE_MESSAGE_TYPE) {
        const setValueMessage = message as DrawnixSetValueMessage;
        const { children: newChildren, viewport: newViewport, senderContainerSize } = setValueMessage.payload;
        if (newChildren !== undefined) {
          setExternalValue(newChildren);
        }
        if (newViewport !== undefined && board) {
          clearViewportOrigination(board);
          setExternalViewport(scaleViewport(newViewport, senderContainerSize));
        }
        return;
      }
      if (DRAWNIX_ADD_IMAGE_MESSAGE_TYPES.has(message.type)) {
        const imageData = getImageFromMessage(message);
        if (!imageData.imageUrl || !board) {
          return;
        }
        const imageItem = {
          url: imageData.imageUrl,
          width: imageData.width || 400,
          height: imageData.height || 300,
        };
        const point = imageData.x !== undefined && imageData.y !== undefined
          ? [imageData.x, imageData.y] as [number, number]
          : undefined;
        DrawTransforms.insertImage(board, imageItem, point);
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
                // 过滤掉 set_selection 操作和远程 operations
                const filteredOperations = data.operations.filter(
                  (op) =>
                    !PlaitOperation.isSetSelectionOperation(op) &&
                    !remoteOperationsRef.current.has(op)
                );

                // 应用完成后清理已处理的远程 operations
                data.operations.forEach((op) => {
                  remoteOperationsRef.current.delete(op);
                });

                // 如果过滤后没有 operations，直接返回不发送
                if (filteredOperations.length === 0) {
                  return;
                }

                // 如果有 pending 数据，合并 operations（set_viewport 取最后值）
                const pending = pendingDataRef.current;
                const mergedOperations = pending
                  ? mergeOperations(pending.operations, filteredOperations)
                  : filteredOperations;

                const currentData = {
                  children: data.children,
                  operations: mergedOperations,
                  viewport: data.viewport,
                  selection: data.selection,
                };

                // Store as pending data
                pendingDataRef.current = currentData;

                // Clear existing timer
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }

                // Set new timer to send data after delay
                debounceTimerRef.current = setTimeout(() => {
                  const pendingToSend = pendingDataRef.current;
                  if (pendingToSend && pendingToSend.operations.length > 0) {
                    // 过滤 remove_node 中的 node 字段以减少数据包大小
                    // 接收端 apply remove_node 时仅使用 path，不需要 node
                    const sanitizedPayload = {
                      ...pendingToSend,
                      operations: pendingToSend.operations.map((op: any) => {
                        if (op.type === 'remove_node') {
                          const { node, ...rest } = op;
                          return rest;
                        }
                        return op;
                      }),
                    };
                    // 附加发送端容器尺寸，供接收端做 viewport 比例换算
                    const currentBoard = boardRef.current;
                    if (currentBoard) {
                      const rect = PlaitBoard.getBoardContainer(currentBoard).getBoundingClientRect();
                      (sanitizedPayload as any).senderContainerSize = {
                        width: rect.width || 1,
                        height: rect.height || 1,
                      };
                    }
                    postSyncMessage({
                      type: DRAWNIX_CHANGE_MESSAGE_TYPE,
                      payload: cloneSerializableData(sanitizedPayload),
                    });
                    lastSentDataRef.current = pendingToSend;
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
