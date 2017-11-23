import React from 'react';
import { mount } from 'enzyme';

import { withIntl } from '../../../test/utils';
import AddTotal from '../../Totals/AddTotal';
import RemoveRows from '../../Totals/RemoveRows';
import TotalCells from '../TotalCells';

const WrappedTotalCells = withIntl(TotalCells);

describe('TotalCells', () => {
    function render(customProps = {}) {
        const props = {
            totals: [],
            editAllowed: false,
            headersCount: 3,
            columnIndex: 1,
            firstMeasureIndex: 1,
            header: { type: 'measure' },
            ...customProps
        };

        return mount(
            <WrappedTotalCells
                {...props}
            />
        );
    }

    const TOTALS = [
        {
            type: 'sum',
            values: [null, 125],
            outputMeasureIndexes: []
        }, {
            type: 'avg',
            values: [45.98, 12.32],
            outputMeasureIndexes: []
        }, {
            type: 'nat',
            values: [12.99, 1.008],
            outputMeasureIndexes: []
        }
    ];

    describe('totals edit not allowed', () => {
        it('should render no totals when totals not provided', () => {
            const wrapper = render();

            expect(wrapper.find('.indigo-table-footer-cell').length).toEqual(0);
        });

        it('should render totals when totals provided', () => {
            const wrapper = render({
                totals: TOTALS
            });

            expect(wrapper.find('.indigo-table-footer-cell').length).toEqual(3);
        });

        it('should not render add total buttons', () => {
            const wrapper = render();

            expect(wrapper.find(AddTotal).length).toEqual(0);
        });

        it('should not render remove buttons when totals are provided', () => {
            const wrapper = render();

            expect(wrapper.find(RemoveRows).length).toEqual(0);
        });
    });

    describe('totals edit allowed', () => {
        it('should render footer cells for add totals buttons into column', () => {
            const wrapper = render({
                editAllowed: true
            });

            expect(wrapper.find('.indigo-totals-add-cell').length).toEqual(1);
        });

        describe('columns edit', () => {
            it('should render enable total button when no columns enabled', () => {
                const wrapper = render({
                    editAllowed: true,
                    totals: [{
                        type: 'sum',
                        outputMeasureIndexes: []
                    }]
                });

                expect(wrapper.find('.indigo-totals-enable-column-button').length).toEqual(1);
            });

            it('should render disable total button when some column enabled', () => {
                const wrapper = render({
                    editAllowed: true,
                    totals: [{
                        type: 'sum',
                        outputMeasureIndexes: [0]
                    }]
                });

                expect(wrapper.find('.indigo-totals-disable-column-button').length).toEqual(1);
            });

            it('should not render value when no column enabled', () => {
                const wrapper = render({
                    editAllowed: true,
                    totals: [{
                        type: 'sum',
                        outputMeasureIndexes: []
                    }]
                });

                expect(wrapper.find('.indigo-table-footer-cell').at(0).text().length).toBe(0);
            });

            it('should render value when some column enabled', () => {
                const wrapper = render({
                    editAllowed: true,
                    totals: [{
                        type: 'sum',
                        outputMeasureIndexes: [0]
                    }]
                });

                expect(wrapper.find('.indigo-table-footer-cell').at(0).text().length).toBeGreaterThan(0);
            });

            it('should bind events on enable column buttons', () => {
                const events = {
                    onEnableColumn: jest.fn()
                };
                const wrapper = render({
                    editAllowed: true,
                    totals: [{
                        type: 'sum',
                        outputMeasureIndexes: []
                    }],
                    ...events
                });
                const button = wrapper.find('.indigo-totals-enable-column-button').at(0);
                button.simulate('click');

                expect(events.onEnableColumn).toBeCalledWith('sum', 1);
            });

            it('should bind events on disable column buttons', () => {
                const events = {
                    onDisableColumn: jest.fn()
                };
                const wrapper = render({
                    editAllowed: true,
                    totals: [{
                        type: 'sum',
                        outputMeasureIndexes: [0]
                    }],
                    ...events
                });
                const button = wrapper.find('.indigo-totals-disable-column-button').at(0);
                button.simulate('click');

                expect(events.onDisableColumn).toBeCalledWith('sum', 1);
            });
        });

        describe('add totals buttons', () => {
            it('should not render into first column', () => {
                const wrapper = render({
                    editAllowed: true,
                    headersCount: 2,
                    columnIndex: 0,
                    header: { type: 'measure' }
                });

                expect(wrapper.find(AddTotal).length).toEqual(0);
            });

            it('should render into other measure columns', () => {
                const wrapper = render({
                    editAllowed: true
                });

                expect(wrapper.find(AddTotal).length).toEqual(1);
            });

            it('should not render into attribute column', () => {
                const wrapper = render({
                    editAllowed: true,
                    header: { type: 'attribute' }
                });

                expect(wrapper.find(AddTotal).length).toEqual(0);
            });

            it('should bind mouse events on total cell', () => {
                const events = {
                    onCellMouseEnter: jest.fn(),
                    onCellMouseLeave: jest.fn()
                };
                const wrapper = render({
                    editAllowed: true,
                    totals: TOTALS,
                    ...events
                });
                const cell = wrapper.find('.indigo-table-footer-cell.col-1').at(0);

                cell.simulate('mouseEnter');

                expect(events.onCellMouseEnter).toBeCalledWith(0, 1);

                cell.simulate('mouseLeave');

                expect(events.onCellMouseLeave).toBeCalledWith(0, 1);
            });
        });
    });
});
