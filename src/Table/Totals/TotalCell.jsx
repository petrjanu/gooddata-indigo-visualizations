import React, { Component } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { uniqueId, noop } from 'lodash';
import { Cell } from 'fixed-data-table-2';
import { injectIntl, intlShape } from 'react-intl';

import {
    DEFAULT_FOOTER_ROW_HEIGHT,
    TOTALS_ADD_ROW_HEIGHT
} from '../TableVisualization';
import { getStyledLabel } from '../utils/cell';
import {
    getTotalsDatasource,
    hasTableColumnTotalEnabled,
    isAddingMoreTotalsEnabled,
    shouldShowAddTotalButton
} from './utils';
import AddTotal from './AddTotal';

import { TotalsWithDataPropTypes } from '../../proptypes/totals';

export class TotalCell extends Component {
    static propTypes = {
        totalsWithData: TotalsWithDataPropTypes.isRequired,
        columnIndex: PropTypes.number.isRequired,
        header: PropTypes.object.isRequired,
        headersCount: PropTypes.number.isRequired,
        firstMeasureIndex: PropTypes.number.isRequired,
        editAllowed: PropTypes.bool,
        onCellMouseEnter: PropTypes.func,
        onCellMouseLeave: PropTypes.func,
        onEnableColumn: PropTypes.func,
        onDisableColumn: PropTypes.func,
        onAddDropdownOpenStateChanged: PropTypes.func,
        onAddWrapperHover: PropTypes.func,
        onAddButtonHover: PropTypes.func,
        onRowAdd: PropTypes.func,
        intl: intlShape.isRequired
    };

    static defaultProps = {
        editAllowed: false,
        onCellMouseEnter: noop,
        onCellMouseLeave: noop,
        onEnableColumn: noop,
        onDisableColumn: noop,
        onAddDropdownOpenStateChanged: noop,
        onAddWrapperHover: noop,
        onAddButtonHover: noop,
        onRowAdd: noop
    };


    renderAddTotalButton(header, columnIndex, headersCount) {
        const { totalsWithData, intl } = this.props;

        if (!shouldShowAddTotalButton(header, columnIndex === 0, true)) {
            return null;
        }

        const dataSource = getTotalsDatasource(totalsWithData, intl);

        return (
            <AddTotal
                dataSource={dataSource}
                header={header}
                columnIndex={columnIndex}
                headersCount={headersCount}
                onDropdownOpenStateChanged={(colIndex, isOpened) => {
                    this.props.onAddDropdownOpenStateChanged(colIndex, isOpened);
                }}
                onWrapperHover={(colIndex, isHighlighted) => {
                    this.props.onAddWrapperHover(colIndex, isHighlighted);
                }}
                onButtonHover={(isHovered) => {
                    this.props.onAddButtonHover(columnIndex, isHovered);
                }}
                onAddTotalsRow={(colIndex, totalItemType) => {
                    this.props.onRowAdd(colIndex, totalItemType);
                }}
                addingMoreTotalsEnabled={isAddingMoreTotalsEnabled(totalsWithData)}
            />
        );
    }

    renderEditCell(header, columnIndex, headersCount) {
        if (!this.props.editAllowed) {
            return null;
        }

        const style = { height: TOTALS_ADD_ROW_HEIGHT };

        const className = cx('indigo-table-footer-cell', `col-${columnIndex}`, 'indigo-totals-add-cell');

        return (
            <div className={className} style={style}>
                {this.renderAddTotalButton(header, columnIndex, headersCount)}
            </div>
        );
    }

    renderMeasureCellContent(label, total, header, columnIndex) {
        const { firstMeasureIndex, editAllowed } = this.props;

        if (header.type !== 'measure') {
            return null;
        }

        const columnHasTotal = hasTableColumnTotalEnabled(total.outputMeasureIndexes, columnIndex, firstMeasureIndex);

        const labelElement = (
            <span className={cx('s-total-column-value')} title={label}>{label}</span>
        );

        if (editAllowed) {
            if (columnHasTotal) {
                return (
                    <span>
                        <span
                            className={cx('button-link', 'button-icon-only', 'icon-circle-cross',
                                'indigo-totals-disable-column-button', `s-disable-total-column-${total.type}-${columnIndex}`
                            )}
                            onClick={() => {
                                this.props.onDisableColumn(columnIndex, total.type);
                            }}
                        />
                        {labelElement}
                    </span>
                );
            }

            return (
                <span
                    className={cx('button-link', 'button-icon-only', 'icon-circle-plus',
                        'indigo-totals-enable-column-button', `s-enable-total-column-${total.type}-${columnIndex}`
                    )}
                    onClick={() => {
                        this.props.onEnableColumn(columnIndex, total.type);
                    }}
                />
            );
        }

        if (!editAllowed && columnHasTotal) {
            return labelElement;
        }

        return null;
    }

    renderCellContent(isFirstColumn, isMeasureColumn, columnIndex, measureColumnIndex, total, header) {
        if (isFirstColumn) {
            return total.alias || this.props.intl.formatMessage({
                id: `visualizations.totals.row.title.${total.type}`
            });
        }

        if (isMeasureColumn) {
            const value = total.values[measureColumnIndex] === null ? '' : total.values[measureColumnIndex];
            const { label } = getStyledLabel(header, value);
            return this.renderMeasureCellContent(label, total, header, columnIndex);
        }

        return '';
    }

    render() {
        const {
            columnIndex,
            header,
            totalsWithData,
            editAllowed,
            headersCount,
            firstMeasureIndex,
            onCellMouseEnter,
            onCellMouseLeave
        } = this.props;

        const isFirstColumn = (columnIndex === 0);
        const measureColumnIndex = columnIndex - firstMeasureIndex;
        const isMeasureColumn = measureColumnIndex >= 0;

        const cellContent = totalsWithData.map((total, rowIndex) => {
            const className = cx('indigo-table-footer-cell', `col-${columnIndex}`);
            const style = { height: DEFAULT_FOOTER_ROW_HEIGHT };

            const events = editAllowed ? {
                onMouseEnter: () => {
                    onCellMouseEnter(rowIndex, columnIndex);
                },
                onMouseLeave: () => {
                    onCellMouseLeave(rowIndex, columnIndex);
                }
            } : {};

            return (
                <div {...events} key={uniqueId('footer-cell-')} className={className} style={style}>
                    {this.renderCellContent(
                        isFirstColumn,
                        isMeasureColumn,
                        columnIndex,
                        measureColumnIndex,
                        total,
                        header
                    )}
                </div>
            );
        });

        return (
            <Cell>
                {cellContent}
                {this.renderEditCell(header, columnIndex, headersCount)}
            </Cell>
        );
    }
}

export default injectIntl(TotalCell);
