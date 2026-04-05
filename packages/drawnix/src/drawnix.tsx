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
import { withGroup } from '@plait/common';
import { withDraw } from '@plait/draw';
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
import { ArrowLineShape, BasicShapes } from '@plait/draw';
import { BoardCreationMode, setCreationMode } from '@plait/common';
import { FreehandShape } from './plugins/freehand/type';

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

const DRAWNIX_SET_TOOL_MESSAGE_TYPES = new Set([
  'drawnix:set-tool',
  'drawnix:setTool',
  'set-tool',
  'setTool',
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
      if (
        typeof message.type !== 'string' ||
        !DRAWNIX_SET_TOOL_MESSAGE_TYPES.has(message.type)
      ) {
        return;
      }
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
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [board, iframeControlEnabled, iframeControl?.allowedOrigins]);

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
                <PopupToolbar></PopupToolbar>
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
