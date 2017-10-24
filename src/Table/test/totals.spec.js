/* eslint-disable react/jsx-filename-extension,react/no-multi-comp */
import React, { Component } from 'react';
import { mount } from 'enzyme';

import { createIntlMock } from '../../test/utils';
import {
    getTotalsTypesList,
    getTotalsDatasource,
    getTotalFromListByType,
    addTotalMeasureIndexes,
    toggleCellClass,
    resetRowClass,
    isAddingMoreTotalsEnabled
} from '../totals';

const intl = createIntlMock();

describe('Totals', () => {
    describe('getTotalsTypesList', () => {
        it('should return proper list of total types', () => {
            const totalTypes = getTotalsTypesList();

            expect(totalTypes).toEqual([
                'sum',
                'avg',
                'min',
                'max',
                'nat',
                'med'
            ]);
        });
    });

    describe('getTotalsDatasource', () => {
        const usedTotals = [
            { type: 'sum' },
            { type: 'avg' }
        ];
        const dataSource = getTotalsDatasource(usedTotals, intl);

        it('should return rows count of 7 (header + 6 totals)', () => {
            expect(dataSource.rowsCount).toEqual(7);
        });

        describe('getObjectAt', () => {
            it('should return disabled "avg" on index 2 when it is already used', () => {
                expect(dataSource.getObjectAt(2)).toEqual({
                    alias: 'Avg',
                    disabled: true,
                    title: 'Avg',
                    type: 'avg'
                });
            });

            it('should return enabled "Rollup" on index 5 when it is not used already', () => {
                expect(dataSource.getObjectAt(5)).toEqual({
                    alias: 'Total',
                    disabled: false,
                    title: 'Rollup (Total)',
                    type: 'nat'
                });
            });
        });
    });

    describe('getTotalFromListByType', () => {
        it('should return `sum` total item', () => {
            const total = getTotalFromListByType('sum', intl);

            expect(total).toEqual({
                alias: 'Sum', type: 'sum'
            });
        });

        it('should return `max` total item', () => {
            const total = getTotalFromListByType('max', intl);

            expect(total).toEqual({
                alias: 'Max', type: 'max'
            });
        });

        it('should return `nat` total item', () => {
            const total = getTotalFromListByType('nat', intl);

            expect(total).toEqual({
                alias: 'Total', type: 'nat'
            });
        });
    });

    describe('addTotalMeasureIndexes', () => {
        it('should add an empty array as `outputMeasureIndexes` property in order to be valid for backend', () => {
            const totals = [
                { type: 'sum' },
                { type: 'avg' }
            ];
            const totalsWithEmptyMeasureIndexedArray = addTotalMeasureIndexes(totals);

            expect(totalsWithEmptyMeasureIndexedArray).toEqual([
                {
                    type: 'sum',
                    outputMeasureIndexes: []
                }, {
                    type: 'avg',
                    outputMeasureIndexes: []
                }
            ]);
        });
    });

    describe('toggleCellClass', () => {
        const testClassname = 'toggle';

        class CellTestComponent extends Component {
            render() {
                return (
                    <div ref={(ref) => { this.parentRef = ref; }}>
                        <span className="col-1" />
                        <span className={`col-2 ${testClassname}`} />
                        <span className="col-2" />
                    </div>
                );
            }
        }

        it('should remove given classname to all cells having a particular classname', () => {
            const cell = mount(<CellTestComponent />);
            const cellReference = cell.instance().parentRef;

            toggleCellClass(cellReference, false, 2, testClassname);

            expect(cellReference.querySelectorAll(`.${testClassname}`).length).toEqual(0);
        });

        it('should add given classname to all cells having a particular classname', () => {
            const cell = mount(<CellTestComponent />);
            const cellReference = cell.instance().parentRef;

            toggleCellClass(cellReference, true, 2, testClassname);

            expect(cellReference.querySelectorAll(`.${testClassname}`).length).toEqual(2);
        });
    });

    describe('resetRowClass', () => {
        const testClassname = 'toggle';

        class RowTestComponent extends Component {
            render() {
                return (
                    <div ref={(ref) => { this.parentRef = ref; }}>
                        <div className="indigo-totals-remove">
                            <div className={`indigo-totals-remove-row ${testClassname}`} />
                            <div className="indigo-totals-remove-row" />
                            <div className="indigo-totals-remove-row" />
                        </div>
                    </div>
                );
            }
        }

        it('should remove given classname from all rows and set it to one row on a given index', () => {
            const row = mount(<RowTestComponent />);
            const rowReference = row.instance().parentRef;
            const oldIndex = 0;
            const newIndex = 2;

            resetRowClass(rowReference, testClassname, newIndex);

            expect(rowReference.querySelectorAll(`.${testClassname}`).length).toEqual(1);
            expect(rowReference.querySelectorAll('.indigo-totals-remove-row')[oldIndex].classList.contains(testClassname)).toEqual(false);
            expect(rowReference.querySelectorAll('.indigo-totals-remove-row')[newIndex].classList.contains(testClassname)).toEqual(true);
        });

        it('should keep given classname if row on the given index already has one', () => {
            const row = mount(<RowTestComponent />);
            const rowReference = row.instance().parentRef;
            const index = 0;

            expect(rowReference.querySelectorAll('.indigo-totals-remove-row')[index].classList.contains(testClassname)).toEqual(true);

            resetRowClass(rowReference, testClassname, index);

            expect(rowReference.querySelectorAll('.indigo-totals-remove-row')[index].classList.contains(testClassname)).toEqual(true);
        });
    });

    describe('isAddingMoreTotalsEnabled', () => {
        it('should return true if there are some totals remaining to add', () => {
            const totals = [1, 2, 3];
            const addingEnabled = isAddingMoreTotalsEnabled(totals);

            expect(addingEnabled).toEqual(true);
        });

        it('should return false if there are no more totals remaining to add', () => {
            const totals = [1, 2, 3, 4, 5, 6];
            const addingEnabled = isAddingMoreTotalsEnabled(totals);

            expect(addingEnabled).toEqual(false);
        });
    });
});
