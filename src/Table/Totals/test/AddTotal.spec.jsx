import React from 'react';
import { mount } from 'enzyme';
import Dropdown from '@gooddata/goodstrap/lib/Dropdown/Dropdown';

import AddTotal from '../AddTotal';
import TableTotalsAddButton from '../AddTotalButton';

describe('AddTotal', () => {
    function renderComponent(customProps = {}) {
        const props = {
            dataSource: {},
            header: { type: 'measure' },
            columnIndex: 3,
            headersCount: 5,
            addingMoreTotalsEnabled: true
        };

        return mount(
            <AddTotal {...props} {...customProps} />
        );
    }

    it('should render component', () => {
        const component = renderComponent();

        expect(component.find('.indigo-totals-add-wrapper').length).toBe(1);
    });

    it('should call onDropdownOpenStateChanged and set/unset wrapper class on dropdown open/close', () => {
        const onDropdownOpenStateChanged = jest.fn();
        const component = renderComponent({
            onDropdownOpenStateChanged
        });

        const componentInstance = component.instance();
        const componentNode = component.childAt(0).instance();

        componentInstance.onOpenStateChanged(3, true);

        expect(onDropdownOpenStateChanged).toBeCalledWith(3, true);
        expect(componentNode.classList).toContain('dropdown-active');

        componentInstance.onOpenStateChanged(3, false);

        expect(onDropdownOpenStateChanged).toBeCalledWith(3, false);
        expect(componentNode.classList).not.toContain('dropdown-active');
    });

    it('should properly call \'onWrapperHover\' callback upon particular events', () => {
        const headerIndex = 2;
        const onWrapperHover = jest.fn();
        const component = renderComponent({
            columnIndex: headerIndex,
            onWrapperHover
        });

        component.find('.indigo-totals-add-wrapper').simulate('mouseenter');

        expect(onWrapperHover).toBeCalledWith(headerIndex, true);
        expect(onWrapperHover.mock.calls.length).toEqual(1);

        component.find('.indigo-totals-add-wrapper').simulate('mouseleave');

        expect(onWrapperHover).toBeCalledWith(headerIndex, false);
        expect(onWrapperHover.mock.calls.length).toEqual(2);
    });

    it('should render <Dropdown /> component inside of the <AddTotal /> component', () => {
        const component = renderComponent();

        expect(component.find(Dropdown).length).toBe(1);
    });

    describe('rendering <TableTotalsAddButton /> dropdown button component', () => {
        it('should render dropdown button', () => {
            const component = renderComponent();

            expect(component.find(TableTotalsAddButton).length).toBe(1);
        });

        it('should pass \'hidden\' prop to dropdown button', () => {
            const component = renderComponent();
            const props = component.find(TableTotalsAddButton).props();

            expect(props.hidden).toBe(false);
        });

        it('should properly call given callbacks upon particular events on dropdown button', () => {
            const onDropdownOpenStateChanged = jest.fn();
            const onButtonHover = jest.fn();
            const component = renderComponent({
                onDropdownOpenStateChanged,
                onButtonHover
            });

            component.find(TableTotalsAddButton).props().onClick();
            expect(onDropdownOpenStateChanged.mock.calls.length).toEqual(1);

            component.find(TableTotalsAddButton).props().onMouseEnter();
            expect(onButtonHover).toBeCalledWith(true);
            expect(onButtonHover.mock.calls.length).toEqual(1);

            component.find(TableTotalsAddButton).props().onMouseLeave();
            expect(onButtonHover).toBeCalledWith(false);
            expect(onButtonHover.mock.calls.length).toEqual(2);
        });
    });
});
