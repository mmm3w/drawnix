import classNames from 'classnames';
import { Island } from '../../island';
import Stack from '../../stack';
import { ToolButton } from '../../tool-button';
import { EraseIcon, FeltTipPenIcon } from '../../icons';
import { BoardTransforms, PlaitBoard } from '@plait/core';
import React from 'react';
import { BoardCreationMode, setCreationMode } from '@plait/common';
import { FreehandShape } from '../../../plugins/freehand/type';
import { useBoard } from '@plait-board/react-board';
import { DrawnixPointerType } from '../../../hooks/use-drawnix';
import { Translations, useI18n } from '../../../i18n';
import { CLASSIC_COLORS } from '../../../constants/color';
import { DEFAULT_FREEHAND_PRESET_SIZES } from '../../../constants/freehand';
import {
  FreehandStylePresetItem,
  FreehandStylePreset,
} from './freehand-style-preset-item';
import './freehand-style-preset-item.scss';

type FreehandToolItem = {
  type: 'tool';
  titleKey: keyof Translations;
  icon: React.ReactNode;
  pointer: FreehandShape.feltTipPen | FreehandShape.eraser;
};

type FreehandPresetItem = FreehandStylePreset & {
  type: 'preset';
};

export type FreehandItem = FreehandToolItem | FreehandPresetItem;

const getClassicColorValue = (name: string) => {
  return CLASSIC_COLORS.find((item) => item.name === name)?.value;
};

export const DEFAULT_FREEHAND_PRESETS: FreehandPresetItem[] = [
  {
    type: 'preset',
    id: 'preset-1',
    color: getClassicColorValue('color.default') || CLASSIC_COLORS[1].value,
    size: DEFAULT_FREEHAND_PRESET_SIZES.preset1,
  },
  {
    type: 'preset',
    id: 'preset-2',
    color: getClassicColorValue('color.red') || CLASSIC_COLORS[5].value,
    size: DEFAULT_FREEHAND_PRESET_SIZES.preset2,
  },
  {
    type: 'preset',
    id: 'preset-3',
    color: getClassicColorValue('color.green') || CLASSIC_COLORS[6].value,
    size: DEFAULT_FREEHAND_PRESET_SIZES.preset3,
  },
];

export const FreeHandItems: FreehandItem[] = [
  {
    type: 'tool',
    icon: FeltTipPenIcon,
    pointer: FreehandShape.feltTipPen,
    titleKey: 'toolbar.pen',
  },
  {
    type: 'tool',
    icon: EraseIcon,
    pointer: FreehandShape.eraser,
    titleKey: 'toolbar.eraser',
  },
  ...DEFAULT_FREEHAND_PRESETS,
];

export const FREEHANDS = FreeHandItems;

const FIRST_PRESET_ID =
  FreeHandItems.find(
    (item): item is FreehandPresetItem => item.type === 'preset'
  )?.id || '';

const isFreehandPresetItem = (item: FreehandItem): item is FreehandPresetItem =>
  item.type === 'preset';

const isFreehandToolItem = (item: FreehandItem): item is FreehandToolItem =>
  item.type === 'tool';

const toPreset = (item: FreehandPresetItem): FreehandStylePreset => ({
  id: item.id,
  color: item.color,
  size: item.size,
});

const updatePresetInItems = (
  items: FreehandItem[],
  presetId: string,
  updater: (preset: FreehandPresetItem) => FreehandPresetItem
): FreehandItem[] =>
  items.map((item) =>
    isFreehandPresetItem(item) && item.id === presetId ? updater(item) : item
  );

const getPresetItems = (items: FreehandItem[]): FreehandPresetItem[] =>
  items.filter((item): item is FreehandPresetItem =>
    isFreehandPresetItem(item)
  );
const getToolItems = (items: FreehandItem[]): FreehandToolItem[] =>
  items.filter((item): item is FreehandToolItem => isFreehandToolItem(item));

export type FreehandPickerProps = {
  onPointerUp: (pointer: DrawnixPointerType) => void;
};

export const FreehandPanel: React.FC<FreehandPickerProps> = ({
  onPointerUp,
}) => {
  const { t } = useI18n();
  const board = useBoard();
  const container = PlaitBoard.getBoardContainer(board);
  const [items, setItems] = React.useState<FreehandItem[]>(FreeHandItems);
  const [activePresetId, setActivePresetId] =
    React.useState<string>(FIRST_PRESET_ID);

  const setPenPointer = () => {
    setCreationMode(board, BoardCreationMode.drawing);
    BoardTransforms.updatePointerType(board, FreehandShape.feltTipPen);
    onPointerUp(FreehandShape.feltTipPen);
  };

  return (
    <Island padding={1}>
      <Stack.Row gap={1} align="start" className="freehand-style-list">
        {getToolItems(items).map((freehand, index) => (
          <ToolButton
            key={index}
            className={classNames({ fillable: false })}
            selected={board.pointer === freehand.pointer}
            type="icon"
            size={'small'}
            visible={true}
            icon={freehand.icon}
            title={t(freehand.titleKey)}
            aria-label={t(freehand.titleKey)}
            onPointerDown={() => {
              setCreationMode(board, BoardCreationMode.dnd);
              BoardTransforms.updatePointerType(board, freehand.pointer);
            }}
            onPointerUp={() => {
              setCreationMode(board, BoardCreationMode.drawing);
              onPointerUp(freehand.pointer);
            }}
          />
        ))}
        {getPresetItems(items).map((preset) => (
          <FreehandStylePresetItem
            key={preset.id}
            preset={toPreset(preset)}
            selected={activePresetId === preset.id}
            container={container}
            onSelect={() => {
              setActivePresetId(preset.id);
              setPenPointer();
            }}
            onColorChange={(color) => {
              setItems((value) =>
                updatePresetInItems(value, preset.id, (item) => ({
                  ...item,
                  color,
                }))
              );
            }}
            onSizeChange={(size) => {
              setItems((value) =>
                updatePresetInItems(value, preset.id, (item) => ({
                  ...item,
                  size,
                }))
              );
            }}
          />
        ))}
      </Stack.Row>
    </Island>
  );
};
