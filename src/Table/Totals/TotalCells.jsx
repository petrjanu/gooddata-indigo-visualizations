import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { uniqueId, noop } from 'lodash';
import { Cell } from 'fixed-data-table-2';
import { injectIntl } from 'react-intl';

import {
    DEFAULT_FOOTER_ROW_HEIGHT,
    TOTALS_ADD_ROW_HEIGHT,
    totalsDefaultProp,
    totalsPropType
} from '../TableVisualization';
import { getStyledLabel } from '../utils/cell';
import {
    getOrderedTotalsWithMockedData,
    getTotalsDatasource, hasTableColumnTotalEnabled,
    isAddingMoreTotalsEnabled,
    shouldShowAddTotalButton
} from './utils';
import AddTotal from './AddTotal';

export class TotalCells extends Component {
    static propTypes = {
        totals: PropTypes.array.isRequired,
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
        ...totalsPropType
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
        onRowAdd: noop,
        ...totalsDefaultProp
    };


    renderAddTotalButton(header, columnIndex, headersCount) {
        const { totals, intl } = this.props;

        if (!shouldShowAddTotalButton(header, columnIndex === 0, true)) {
            return null;
        }

        const dataSource = getTotalsDatasource(totals, intl);

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
                onAddTotalsRow={(totalItemType) => {
                    this.props.onRowAdd(totalItemType);
                }}
                addingMoreTotalsEnabled={isAddingMoreTotalsEnabled(totals)}
            />
        );
    }

    renderFooterEditCell(header, columnIndex, headersCount) {
        if (!this.props.editAllowed) {
            return null;
        }

        const style = { height: TOTALS_ADD_ROW_HEIGHT };

        const className = classNames('indigo-table-footer-cell', `col-${columnIndex}`, 'indigo-totals-add-cell');

        return (
            <div className={className} style={style}>
                {this.renderAddTotalButton(header, columnIndex, headersCount)}
            </div>
        );
    }

    renderFooterCellTotalContent(label, total, header, columnIndex) {
        const { firstMeasureIndex, editAllowed } = this.props;

        if (header.type !== 'measure' || !editAllowed) {
            return null;
        }

        const columnHasTotal = hasTableColumnTotalEnabled(total.outputMeasureIndexes, columnIndex, firstMeasureIndex);

        if (columnHasTotal) {
            return (
                <span>
                    <span
                        className={classNames('button-link', 'button-icon-only', 'icon-circle-cross',
                            'indigo-totals-disable-column-button', `s-disable-total-column-${total.type}-${columnIndex}`
                        )}
                        onClick={() => {
                            this.props.onDisableColumn(total.type, columnIndex);
                        }}
                    />
                    <span className={classNames('s-total-column-value')}>{label}</span>
                </span>
            );
        }

        return (
            <span
                className={classNames('button-link', 'button-icon-only', 'icon-circle-plus',
                    'indigo-totals-enable-column-button', `s-enable-total-column-${total.type}-${columnIndex}`
                )}
                onClick={() => {
                    this.props.onEnableColumn(total.type, columnIndex);
                }}
            />
        );
    }

    render() {
        const {
            columnIndex,
            header,
            totals,
            editAllowed,
            headersCount,
            onCellMouseEnter,
            onCellMouseLeave
        } = this.props;

        const totalsWithData = getOrderedTotalsWithMockedData(totals);
        const isFirstColumn = (columnIndex === 0);

        const cellContent = totalsWithData.map((total, rowIndex) => {
            const value = total.values[columnIndex] === null ? '' : total.values[columnIndex];
            const className = classNames('indigo-table-footer-cell', `col-${columnIndex}`);
            const { style, label } = getStyledLabel(header, value);
            const styleWithHeight = Object.assign({}, style, { height: DEFAULT_FOOTER_ROW_HEIGHT });
            const totalName = total.alias ? total.alias : total.type;
            const events = editAllowed ? {
                onMouseEnter: () => {
                    onCellMouseEnter(rowIndex, columnIndex);
                },
                onMouseLeave: () => {
                    onCellMouseLeave(rowIndex, columnIndex);
                }
            } : {};
            const content = isFirstColumn ? totalName :
                this.renderFooterCellTotalContent(label, total, header, columnIndex);

            return (
                <div {...events} key={uniqueId('footer-cell-')} className={className} style={styleWithHeight}>
                    {content}
                </div>
            );
        });

        return (
            <Cell>
                {cellContent}
                {this.renderFooterEditCell(header, columnIndex, headersCount)}
            </Cell>
        );
    }
}

export default injectIntl(TotalCells);
