import React, { useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';
import { useInterval } from 'react-use';

import { getMockServiceBinURL, HTTP_METHODS } from '../../../common/constants';
import * as models from '../../../models';
import { useTimeoutWhen } from '../../hooks/useTimeoutWhen';
import { type MockRouteLoaderData, useMockRoutePatcher } from '../../routes/mock-route';
import { useRootLoaderData } from '../../routes/root';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import type { OneLineEditorHandle } from '../codemirror/one-line-editor';
import { Icon } from '../icon';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showModal, showPrompt } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';

export const MockUrlBar = ({ onPathUpdate, onSend }: { onPathUpdate: (path: string) => void; onSend: (path: string) => void }) => {
  const { mockServer, mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const { settings } = useRootLoaderData();
  const { hotKeyRegistry } = settings;
  const patchMockRoute = useMockRoutePatcher();
  const [pathInput, setPathInput] = useState<string>(mockRoute.name);
  const methodDropdownRef = useRef<DropdownHandle>(null);
  const dropdownRef = useRef<DropdownHandle>(null);
  const inputRef = useRef<OneLineEditorHandle>(null);
  const [currentInterval, setCurrentInterval] = useState<number | null>(null);
  const [currentTimeout, setCurrentTimeout] = useState<number | undefined>(undefined);
  const send = () => {
    setCurrentTimeout(undefined);
    onSend(pathInput);
  };
  useInterval(send, currentInterval ? currentInterval : null);
  useTimeoutWhen(send, currentTimeout, !!currentTimeout);
  useDocBodyKeyboardShortcuts({
    request_focusUrl: () => {
      inputRef.current?.selectAll();
    },
    request_send: () => {
      if (mockRoute.name) {
        send();
      }
    },
    request_toggleHttpMethodMenu: () => {
      methodDropdownRef.current?.toggle();
    },
    request_showOptions: () => {
      dropdownRef.current?.toggle(true);
    },
  });
  const isCancellable = currentInterval || currentTimeout;
  return (<div className='w-full flex justify-between self-stretch'>
    <Dropdown
      ref={methodDropdownRef}
      triggerButton={
        <Button className="pad-right pad-left vertically-center hover:bg-[--color-surprise] focus:bg-[--color-surprise]">
          <span className={`http-method-${mockRoute.method}`}>{mockRoute.method}</span>{' '}
          <i className="fa fa-caret-down space-left" />
        </Button>
      }
    >{HTTP_METHODS.map(method => (
      <DropdownItem key={method}>
        <ItemContent
          className={`http-method-${method}`}
          label={method}
          onClick={() => patchMockRoute(mockRoute._id, { method })}
        />
      </DropdownItem>
    ))}
    </Dropdown>
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 rounded-sm"
        onPress={() => {
          showModal(AlertModal, {
            title: 'Full URL',
            message: getMockServiceBinURL(mockServer, pathInput),
            onConfirm: () => window.clipboard.writeText(getMockServiceBinURL(mockServer, pathInput)),
            addCancel: true,
            okLabel: 'Copy',
          });
        }}
      >
        <Icon icon="eye" /> Show URL
      </Button>
    </div>

    <div className='flex flex-1 p-1 items-center'>
      <input className='flex-1' onBlur={() => onPathUpdate(pathInput)} value={pathInput} onChange={e => setPathInput(e.currentTarget.value)} />
    </div>
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 rounded-sm aria-pressed:bg-[--hl-xs] data-[pressed]:bg-[--hl-xs]"
        onPress={() => {
          window.clipboard.writeText(getMockServiceBinURL(mockServer, pathInput));
        }}
      >
        <Icon icon="copy" />
      </Button>
      <Button
        className="px-5 ml-1 text-[--color-font-surprise] bg-[--color-surprise] hover:bg-opacity-90 focus:bg-opacity-90 rounded-l-sm"
        onPress={() => {
          if (isCancellable) {
            setCurrentInterval(null);
            setCurrentTimeout(undefined);
            return;
          }
          onSend(pathInput);
        }}
      >
        {isCancellable ? 'Stop' : 'Test'}
      </Button>
      <Dropdown
        key="dropdown"
        className="flex"
        ref={dropdownRef}
        aria-label="Request Options"
        closeOnSelect={false}
        triggerButton={
          <Button
            className="px-1 bg-[--color-surprise] text-[--color-font-surprise] rounded-r-sm"
            style={{
              borderTopRightRadius: '0.125rem',
              borderBottomRightRadius: '0.125rem',
            }}
          >
            <i className="fa fa-caret-down" />
          </Button>
        }
      >
        <DropdownSection
          aria-label="Basic Section"
          title="Basic"
        >
          <DropdownItem aria-label="send-now">
            <ItemContent icon="arrow-circle-o-right" label="Send Now" hint={hotKeyRegistry.request_send} onClick={send} />
          </DropdownItem>
          <DropdownItem aria-label='Generate Client Code'>
            <ItemContent
              icon="code"
              label="Generate Client Code"
              onClick={async () => {
                const request = await models.request.getByParentId(mockRoute._id);
                request && showModal(GenerateCodeModal, { request: { ...request, url: getMockServiceBinURL(mockServer, pathInput) } });
              }}
            />
          </DropdownItem>
        </DropdownSection>
        <DropdownSection
          aria-label="Advanced Section"
          title="Advanced"
        >
          <DropdownItem aria-label='Send After Delay'>
            <ItemContent
              icon="clock-o"
              label="Send After Delay"
              onClick={() => showPrompt({
                inputType: 'decimal',
                title: 'Send After Delay',
                label: 'Delay in seconds',
                defaultValue: '3',
                onComplete: seconds => {
                  setCurrentTimeout(+seconds * 1000);
                },
              })}
            />
          </DropdownItem>
          <DropdownItem aria-label='Repeat on Interval'>
            <ItemContent
              icon="repeat"
              label="Repeat on Interval"
              onClick={() => showPrompt({
                inputType: 'decimal',
                title: 'Send on Interval',
                label: 'Interval in seconds',
                defaultValue: '3',
                submitName: 'Start',
                onComplete: seconds => {
                  setCurrentInterval(+seconds * 1000);
                },
              })}
            />
          </DropdownItem>
        </DropdownSection>

      </Dropdown>
    </div>
  </div>);
};
