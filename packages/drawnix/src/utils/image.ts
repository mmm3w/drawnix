import { getSelectedElements, PlaitBoard } from '@plait/core';
import { base64ToBlob, boardToImage, download } from './common';
import { fileOpen } from '../data/filesystem';
import { DRAWNIX_EXPORT_IMAGE_MESSAGE_TYPE, IMAGE_MIME_TYPES } from '../constants';
import { insertImage } from '../data/image';

const postExportImageMessage = (
  image: string,
  ext: 'png' | 'jpg',
  isTransparent: boolean,
  board: PlaitBoard
) => {
  const reactNativeWebView = (window as unknown as {
    ReactNativeWebView?: { postMessage?: (message: string) => void };
  }).ReactNativeWebView;
  if (!reactNativeWebView || typeof reactNativeWebView.postMessage !== 'function') {
    return false;
  }
  reactNativeWebView.postMessage(
    JSON.stringify({
      type: DRAWNIX_EXPORT_IMAGE_MESSAGE_TYPE,
      payload: {
        dataUrl: image,
        ext,
        mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
        isTransparent,
        themeColorMode: board.theme?.themeColorMode ?? 'default',
      },
    })
  );
  return true;
};

export const saveAsImage = (board: PlaitBoard, isTransparent: boolean) => {
  const selectedElements = getSelectedElements(board);
  boardToImage(board, {
    elements: selectedElements.length > 0 ? selectedElements : undefined,
    fillStyle: isTransparent ? 'transparent' : 'black',
  }).then((image) => {
    if (image) {
      const ext = isTransparent ? 'png' : 'jpg';
      if (postExportImageMessage(image, ext, isTransparent, board)) {
        return;
      }
      const pngImage = base64ToBlob(image);
      const imageName = `drawnix-${new Date().getTime()}.${ext}`;
      download(pngImage, imageName);
    }
  });
};

export const addImage = async (board: PlaitBoard) => {
  const imageFile = await fileOpen({
    description: 'Image',
    extensions: Object.keys(
      IMAGE_MIME_TYPES
    ) as (keyof typeof IMAGE_MIME_TYPES)[],
  });
  insertImage(board, imageFile);
};
