import { Board, BoardChangeData, Wrapper } from '@plait-board/react-board';
import {
  BoardTransforms,
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
  syncTargetOrigin?: string;
  emitOperationMessage?: boolean;
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

export const DRAWNIX_OPERATION_COMPLETE_EVENT = 'drawnix:operation-complete';
export const DRAWNIX_PATCH_MESSAGE_TYPE = 'drawnix:patch';
export const DRAWNIX_SNAPSHOT_MESSAGE_TYPE = 'drawnix:snapshot';

const DRAWNIX_GET_SNAPSHOT_MESSAGE_TYPES = new Set([
  'drawnix:get-snapshot',
  'drawnix:getSnapshot',
  'get-snapshot',
  'getSnapshot',
]);

export type DrawnixOperationChangeKind =
  | 'selection'
  | 'viewport'
  | 'theme'
  | 'content'
  | 'mixed';

export type DrawnixSnapshot = {
  source: 'drawnix';
  timestamp: number;
  children: PlaitElement[];
  viewport: Viewport;
  selection: Selection | null;
  theme: PlaitTheme;
};

export type DrawnixOperationDelta = {
  source: 'drawnix';
  timestamp: number;
  kind: DrawnixOperationChangeKind;
  operations: BoardChangeData['operations'];
  selection: Selection | null;
  changedElements: PlaitElement[];
};

export type DrawnixOperationCompleteEventDetail = {
  source: 'drawnix';
  timestamp: number;
  delta: DrawnixOperationDelta;
  data?: BoardChangeData;
};

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

const cloneBoardChangeData = (data: BoardChangeData) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return {
    ...data,
    children: [...data.children],
    operations: [...data.operations],
  };
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

const isSelectionOperation = (operation: BoardChangeData['operations'][number]) =>
  operation.type === 'set_selection';

const isViewportOperation = (operation: BoardChangeData['operations'][number]) =>
  operation.type === 'set_viewport';

const isThemeOperation = (operation: BoardChangeData['operations'][number]) =>
  operation.type === 'set_theme';

const getOperationChangeKind = (
  operations: BoardChangeData['operations']
): DrawnixOperationChangeKind => {
  if (operations.every((operation) => isSelectionOperation(operation))) {
    return 'selection';
  }
  if (operations.every((operation) => isViewportOperation(operation))) {
    return 'viewport';
  }
  if (operations.every((operation) => isThemeOperation(operation))) {
    return 'theme';
  }
  if (
    operations.every(
      (operation) =>
        !isSelectionOperation(operation) &&
        !isViewportOperation(operation) &&
        !isThemeOperation(operation)
    )
  ) {
    return 'content';
  }
  return 'mixed';
};

const extractChangedElements = (data: BoardChangeData) => {
  const changedElements: PlaitElement[] = [];
  const changedElementSet = new Set<PlaitElement>();
  const addElement = (element: unknown) => {
    if (!element || typeof element !== 'object') {
      return;
    }
    const plaitElement = element as PlaitElement;
    if (!changedElementSet.has(plaitElement)) {
      changedElementSet.add(plaitElement);
      changedElements.push(plaitElement);
    }
  };
  data.operations.forEach((operation) => {
    const operationRecord = operation as Record<string, unknown>;
    if (Array.isArray(operationRecord.path) && typeof operationRecord.path[0] === 'number') {
      const topLevelIndex = operationRecord.path[0] as number;
      addElement(data.children[topLevelIndex]);
    }
    addElement(operationRecord.node);
    addElement(operationRecord.newNode);
  });
  return cloneSerializableData(changedElements);
};

const buildOperationDelta = (data: BoardChangeData): DrawnixOperationDelta => {
  return {
    source: 'drawnix',
    timestamp: Date.now(),
    kind: getOperationChangeKind(data.operations),
    operations: cloneSerializableData(data.operations),
    selection: cloneSerializableData(data.selection),
    changedElements: extractChangedElements(data),
  };
};

const buildSnapshotFromBoard = (board: PlaitBoard): DrawnixSnapshot => {
  return {
    source: 'drawnix',
    timestamp: Date.now(),
    children: cloneSerializableData(board.children),
    viewport: cloneSerializableData(board.viewport),
    selection: cloneSerializableData(board.selection),
    theme: cloneSerializableData(board.theme),
  };
};

const getSyncTargetOrigin = (
  iframeControl: DrawnixIframeControlOptions | undefined
) => {
  if (iframeControl?.syncTargetOrigin) {
    return iframeControl.syncTargetOrigin;
  }
  if (iframeControl?.allowedOrigins?.length === 1) {
    return iframeControl.allowedOrigins[0];
  }
  return '*';
};

const postPatchMessage = (
  iframeControl: DrawnixIframeControlOptions | undefined,
  delta: DrawnixOperationDelta
) => {
  const message = {
    type: DRAWNIX_PATCH_MESSAGE_TYPE,
    payload: delta,
  };
  if (window.parent !== window) {
    window.parent.postMessage(message, getSyncTargetOrigin(iframeControl));
    return;
  }
  window.postMessage(message, window.location.origin);
};

const emitOperationCompleteEvent = (
  target: HTMLDivElement | null,
  eventName: string,
  detail: DrawnixOperationCompleteEventDetail
) => {
  if (typeof window === 'undefined') {
    return;
  }
  const event = new CustomEvent<DrawnixOperationCompleteEventDetail>(eventName, {
    detail,
    bubbles: true,
  });
  if (target) {
    target.dispatchEvent(event);
    return;
  }
  window.dispatchEvent(event);
};

export type DrawnixProps = {
  value: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
  onChange?: (value: BoardChangeData) => void;
  onOperationComplete?: (detail: DrawnixOperationCompleteEventDetail) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  onValueChange?: (value: PlaitElement[]) => void;
  onViewportChange?: (value: Viewport) => void;
  onThemeChange?: (value: ThemeColorMode) => void;
  emitOperationCompleteEvent?: boolean;
  includeFullDataInOperationEvent?: boolean;
  operationCompleteEventName?: string;
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
  onOperationComplete,
  onSelectionChange,
  onViewportChange,
  onThemeChange,
  onValueChange,
  emitOperationCompleteEvent: shouldEmitOperationCompleteEvent = true,
  includeFullDataInOperationEvent = false,
  operationCompleteEventName = DRAWNIX_OPERATION_COMPLETE_EVENT,
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

  if (board) {
    board.appState = appState;
  }

  const updateAppState = (newAppState: Partial<DrawnixState>) => {
    setAppState((currentAppState) => ({
      ...currentAppState,
      ...newAppState,
    }));
  };

  const iframeControlEnabled = iframeControl?.enabled ?? embedded;

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
      if (!event.data || typeof event.data !== 'object') {
        return;
      }
      const message = event.data as Record<string, unknown>;
      if (typeof message.type !== 'string') {
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
      if (DRAWNIX_GET_SNAPSHOT_MESSAGE_TYPES.has(message.type)) {
        const response = {
          type: DRAWNIX_SNAPSHOT_MESSAGE_TYPE,
          requestId: message.requestId,
          payload: buildSnapshotFromBoard(board),
        };
        if (event.source && 'postMessage' in event.source) {
          (event.source as WindowProxy).postMessage(response, event.origin);
        }
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
              if (!data.operations.length) {
                return;
              }
              const delta = buildOperationDelta(data);
              const detail: DrawnixOperationCompleteEventDetail = {
                source: 'drawnix',
                timestamp: Date.now(),
                delta,
                data: includeFullDataInOperationEvent
                  ? cloneBoardChangeData(data)
                  : undefined,
              };
              onOperationComplete && onOperationComplete(detail);
              if (shouldEmitOperationCompleteEvent) {
                emitOperationCompleteEvent(
                  containerRef.current,
                  operationCompleteEventName,
                  detail
                );
              }
              if (
                iframeControlEnabled &&
                (iframeControl?.emitOperationMessage ?? true)
              ) {
                postPatchMessage(iframeControl, delta);
              }
            }}
            onSelectionChange={onSelectionChange}
            onViewportChange={onViewportChange}
            onThemeChange={onThemeChange}
            onValueChange={onValueChange}
          >
            <Board
              afterInit={(board) => {
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
