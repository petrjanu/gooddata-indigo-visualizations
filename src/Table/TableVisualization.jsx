import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { injectIntl, intlShape } from 'react-intl';
import ReactDOM from 'react-dom';
import { Table, Column, Cell } from 'fixed-data-table-2';
import classNames from 'classnames';
import { noop, partial, pick, uniqueId, assign, isEqual, debounce, remove } from 'lodash';

import List from '@gooddata/goodstrap/lib/List/List';
import Button from '@gooddata/goodstrap/lib/Button/Button';
import Dropdown, { DropdownBody } from '@gooddata/goodstrap/lib/Dropdown/Dropdown';

import Bubble from '@gooddata/goodstrap/lib/Bubble/Bubble';
import BubbleHoverTrigger from '@gooddata/goodstrap/lib/Bubble/BubbleHoverTrigger';
import TableSortBubbleContent from './TableSortBubbleContent';
import { subscribeEvents } from '../utils/common';
import { cellClick, isDrillable } from '../utils/drilldownEventing';
import DrillableItem from '../proptypes/DrillableItem';
import TableTotalsDropdownItem from './TableTotalsDropdownItem';

import {
    getNextSortDir,
    getColumnAlign,
    getStyledLabel,
    getCellClassNames,
    getHeaderClassNames,
    getHeaderSortClassName,
    getTooltipSortAlignPoints,
    getTooltipAlignPoints,
    calculateArrowPositions,
    enrichTableDataHeaders,
    isHeaderAtDefaultPosition,
    isHeaderAtEdgePosition,
    getHeaderPositions,
    isFooterAtDefaultPosition,
    isFooterAtEdgePosition,
    getFooterPositions,
    updatePosition,
    getFooterHeight
} from './utils';
import {
    getTotalsDatasource,
    getTotalFromListByType,
    getOrderedTotalsWithMockedData,
    addTotalMeasureIndexes,
    toggleCellClass,
    resetRowClass,
    isAddingMoreTotalsEnabled
} from './totals';

const MIN_COLUMN_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 30;
export const DEFAULT_HEADER_HEIGHT = 26;
export const DEFAULT_FOOTER_ROW_HEIGHT = 30;

export const TOTALS_ADD_ROW_HEIGHT = 50;
const TOTALS_TYPES_DROPDOWN_WIDTH = 150;

const TOOLTIP_DISPLAY_DELAY = 1000;

const DEBOUNCE_SCROLL_STOP = 500;

export const SCROLL_DEBOUNCE_MILISECONDS = 0;
export const RESIZE_DEBOUNCE_MILISECONDS = 60;

const scrollEvents = [
    {
        name: 'scroll',
        debounce: SCROLL_DEBOUNCE_MILISECONDS
    }, {
        name: 'goodstrap.scrolled',
        debounce: SCROLL_DEBOUNCE_MILISECONDS
    }, {
        name: 'resize',
        debounce: RESIZE_DEBOUNCE_MILISECONDS
    }, {
        name: 'goodstrap.drag',
        debounce: RESIZE_DEBOUNCE_MILISECONDS
    }
];

export class TableVisualization extends Component {
    static propTypes = {
        afm: PropTypes.object,
        totals: PropTypes.arrayOf(PropTypes.shape({
            alias: PropTypes.string,
            type: PropTypes.string,
            outputMeasureIndexes: PropTypes.arrayOf(PropTypes.number)
        })),
        totalsEditAllowed: PropTypes.bool,
        onTotalsEdit: PropTypes.func,
        drillableItems: PropTypes.arrayOf(PropTypes.shape(DrillableItem)),
        onFiredDrillEvent: PropTypes.func,
        containerWidth: PropTypes.number.isRequired,
        containerHeight: PropTypes.number,
        containerMaxHeight: PropTypes.number,
        hasHiddenRows: PropTypes.bool,
        rows: PropTypes.array.isRequired,
        headers: PropTypes.array.isRequired,
        sortInTooltip: PropTypes.bool,
        sortDir: PropTypes.string,
        sortBy: PropTypes.number,
        onSortChange: PropTypes.func,
        stickyHeader: PropTypes.number,
        afterRender: PropTypes.func,
        intl: intlShape.isRequired
    };

    static defaultProps = {
        afm: {},
        totals: [],
        totalsEditAllowed: false,
        onTotalsEdit: noop,
        drillableItems: [],
        onFiredDrillEvent: noop,
        rows: [],
        headers: [],
        onSortChange: noop,
        sortInTooltip: false,
        stickyHeader: -1,
        containerHeight: null,
        containerMaxHeight: null,
        hasHiddenRows: false,
        sortDir: null,
        sortBy: null,
        afterRender: () => {}
    };

    constructor(props) {
        super(props);
        this.state = {
            hintSortBy: null,
            sortBubble: {
                visible: false
            },
            width: 0,
            height: 0
        };

        this.renderTooltipHeader = this.renderTooltipHeader.bind(this);
        this.renderDefaultHeader = this.renderDefaultHeader.bind(this);
        this.setTableRef = this.setTableRef.bind(this);
        this.setTableWrapRef = this.setTableWrapRef.bind(this);
        this.closeBubble = this.closeBubble.bind(this);
        this.scroll = this.scroll.bind(this);
        this.scrolled = this.scrolled.bind(this);
        this.addTotalsRow = this.addTotalsRow.bind(this);
        this.setTotalsRemoveRef = this.setTotalsRemoveRef.bind(this);

        this.scrollingStopped = debounce(() => this.scroll(true), DEBOUNCE_SCROLL_STOP);

        this.addTotalDropdownOpened = false;
    }

    componentDidMount() {
        const { stickyHeader } = this.props;

        this.component = ReactDOM.findDOMNode(this);// eslint-disable-line react/no-find-dom-node
        this.table = ReactDOM.findDOMNode(this.tableRef); // eslint-disable-line react/no-find-dom-node
        this.tableInnerContainer = this.table.querySelector('.fixedDataTableLayout_rowsContainer');

        const tableRows = this.table.querySelectorAll('.fixedDataTableRowLayout_rowWrapper');

        this.header = tableRows[0];
        this.header.classList.add('table-header');

        if (this.hasFooter()) {
            this.footer = tableRows[tableRows.length - 1];
            this.footer.classList.add('table-footer');
        }

        if (this.isSticky(stickyHeader)) {
            this.setListeners();
            this.scrolled();
            this.checkTableDimensions();
        }
    }

    componentWillReceiveProps(nextProps) {
        const current = this.props;
        const currentIsSticky = this.isSticky(current.stickyHeader);
        const nextIsSticky = this.isSticky(nextProps.stickyHeader);

        if (currentIsSticky !== nextIsSticky) {
            if (currentIsSticky) {
                this.unsetListeners();
            }
            if (nextIsSticky) {
                this.setListeners();
            }
        }
    }

    componentDidUpdate(prevProps) {
        const { stickyHeader, totals } = this.props;

        const totalsWithData = getOrderedTotalsWithMockedData(totals);
        const totalsWithDataPrev = getOrderedTotalsWithMockedData(prevProps.totals);

        if (!isEqual(totalsWithDataPrev, totalsWithData)) {
            const tableRows = this.table.querySelectorAll('.fixedDataTableRowLayout_rowWrapper');

            if (this.footer) {
                this.footer.classList.remove('table-footer');
            }

            if (this.hasFooter()) {
                this.footer = tableRows[tableRows.length - 1];
                this.footer.classList.add('table-footer');
            }
        }

        if (this.isSticky(stickyHeader)) {
            this.scroll(true);
            this.checkTableDimensions();
        }

        this.props.afterRender();
    }

    componentWillUnmount() {
        this.unsetListeners();
    }

    setTableRef(ref) {
        this.tableRef = ref;
    }

    setTableWrapRef(ref) {
        this.tableWrapRef = ref;
    }

    setTotalsRemoveRef(ref) {
        this.totalsRemoveRef = ref;
    }

    setListeners() {
        this.subscribers = subscribeEvents(this.scrolled, scrollEvents);
    }

    getSortFunc(column, index) {
        const { onSortChange } = this.props;
        return partial(onSortChange, column, index);
    }

    getSortObj(column, index) {
        const { sortBy, sortDir } = this.props;
        const { hintSortBy } = this.state;

        const dir = (sortBy === index ? sortDir : null);
        const nextDir = getNextSortDir(column, dir);

        return {
            dir,
            nextDir,
            sortDirClass: getHeaderSortClassName(hintSortBy === index ? nextDir : dir, dir)
        };
    }

    getMouseOverFunc(index) {
        return () => {
            // workaround glitch with fixed-data-table-2,
            // where header styles are overwritten first time user mouses over it
            this.scrolled();

            this.setState({ hintSortBy: index });
        };
    }

    getComponentClasses() {
        const { hasHiddenRows } = this.props;

        return classNames(
            'indigo-table-component',
            {
                'has-hidden-rows': hasHiddenRows,
                'has-footer': this.hasFooter(),
                'has-footer-editable': this.isTotalsEditAllowed()
            });
    }

    getContentClasses() {
        const { stickyHeader } = this.props;

        return classNames(
            'indigo-table-component-content',
            {
                'has-sticky-header': this.isSticky(stickyHeader)
            });
    }

    updateTotalsRemovePosition(tableBoundingRect, totals) {
        if (!this.isTotalsEditAllowed()) {
            return;
        }

        const translateY = tableBoundingRect.height - getFooterHeight(totals, this.isTotalsEditAllowed());

        this.totalsRemoveRef.style.bottom = 'auto';
        this.totalsRemoveRef.style.top = `${translateY}px`;
    }

    unsetListeners() {
        if (this.subscribers && this.subscribers.length > 0) {
            this.subscribers.forEach((subscriber) => {
                subscriber.unsubscribe();
            });
            this.subscribers = null;
        }
    }

    isSticky(stickyHeader) {
        return stickyHeader >= 0;
    }

    isTotalUsed(totalItemType) {
        const { totals } = this.props;

        return totals.find(row => row.type === totalItemType);
    }

    addTotalsRow(totalItemType) {
        if (this.isTotalUsed(totalItemType)) {
            return;
        }

        const { totals, intl } = this.props;

        const total = getTotalFromListByType(totalItemType, intl);

        totals.push(total);

        this.props.onTotalsEdit(addTotalMeasureIndexes(totals));
    }

    removeTotalsRow(totalItemType) {
        const { totals } = this.props;

        remove(totals, total => total.type === totalItemType);

        this.props.onTotalsEdit(addTotalMeasureIndexes(totals));
    }

    isTotalsEditAllowed() {
        return this.props.totalsEditAllowed;
    }

    toggleBodyColumnHighlight(isHighlighted, columnIndex) {
        if (this.addTotalDropdownOpened) {
            return;
        }
        toggleCellClass(this.table, isHighlighted, columnIndex, 'indigo-table-cell-highlight');
    }

    toggleFooterColumnHighlight(isHighlighted, columnIndex) {
        if (this.addTotalDropdownOpened) {
            return;
        }
        toggleCellClass(this.footer, isHighlighted, columnIndex, 'indigo-table-footer-cell-highlight');
    }

    resetTotalsRowHighlight(rowIndex) {
        if (!this.isTotalsEditAllowed()) {
            return;
        }
        resetRowClass(this.component, 'indigo-totals-remove-row-highlight', rowIndex);
    }

    hasFooter() {
        if (this.isTotalsEditAllowed()) {
            return true;
        }

        const { headers, totals } = this.props;

        const onlyMetrics = headers.every(column => column.type === 'metric');
        const rowsCount = totals.length;

        return rowsCount > 1 && !onlyMetrics;
    }

    checkTableDimensions() {
        if (this.table) {
            const { width, height } = this.state;
            const rect = this.table.getBoundingClientRect();

            if (width !== rect.width || height !== rect.height) {
                this.setState(pick(rect, 'width', 'height'));
            }
        }
    }

    scrollHeader(isScrollingStopped = false) {
        const { stickyHeader, sortInTooltip, hasHiddenRows, totals } = this.props;
        const tableBoundingRect = this.tableInnerContainer.getBoundingClientRect();
        const totalsEditAllowed = this.isTotalsEditAllowed();

        const isOutOfViewport = tableBoundingRect.bottom < 0;
        if (isOutOfViewport) {
            return;
        }

        if (!isScrollingStopped && sortInTooltip && this.state.sortBubble.visible) {
            this.closeBubble();
        }

        const isDefaultPosition = isHeaderAtDefaultPosition(
            stickyHeader,
            tableBoundingRect.top
        );

        const isEdgePosition = isHeaderAtEdgePosition(
            stickyHeader,
            hasHiddenRows,
            totals,
            tableBoundingRect.bottom,
            totalsEditAllowed
        );

        const positions = getHeaderPositions(
            stickyHeader,
            hasHiddenRows,
            totals,
            totalsEditAllowed,
            {
                height: tableBoundingRect.height,
                top: tableBoundingRect.top
            }
        );

        updatePosition(
            this.header,
            isDefaultPosition,
            isEdgePosition,
            positions,
            isScrollingStopped
        );
    }

    scrollFooter(isScrollingStopped = false) {
        const { hasHiddenRows, totals } = this.props;
        const tableBoundingRect = this.tableInnerContainer.getBoundingClientRect();
        const totalsEditAllowed = this.isTotalsEditAllowed();

        const isOutOfViewport = tableBoundingRect.top > window.innerHeight;
        if (isOutOfViewport || !this.hasFooter()) {
            return;
        }

        const isDefaultPosition = isFooterAtDefaultPosition(
            hasHiddenRows,
            tableBoundingRect.bottom,
            window.innerHeight
        );

        const isEdgePosition = isFooterAtEdgePosition(
            hasHiddenRows,
            totals,
            window.innerHeight,
            totalsEditAllowed,
            {
                height: tableBoundingRect.height,
                bottom: tableBoundingRect.bottom
            }
        );

        const positions = getFooterPositions(
            hasHiddenRows,
            totals,
            window.innerHeight,
            totalsEditAllowed,
            {
                height: tableBoundingRect.height,
                bottom: tableBoundingRect.bottom
            }
        );

        updatePosition(
            this.footer,
            isDefaultPosition,
            isEdgePosition,
            positions,
            isScrollingStopped
        );

        this.updateTotalsRemovePosition(tableBoundingRect, totals);
    }

    scroll(isScrollingStopped = false) {
        this.scrollHeader(isScrollingStopped);
        this.scrollFooter(isScrollingStopped);
    }

    scrolled() {
        this.scroll();
        this.scrollingStopped();
    }

    closeBubble() {
        this.setState({
            sortBubble: {
                visible: false
            }
        });
    }

    isBubbleVisible(index) {
        const { sortBubble } = this.state;
        return sortBubble.visible && sortBubble.index === index;
    }

    renderTooltipHeader(column, index, columnWidth) {
        const headerClasses = getHeaderClassNames(column);
        const bubbleClass = uniqueId('table-header-');
        const cellClasses = classNames(headerClasses, bubbleClass);

        const sort = this.getSortObj(column, index);

        const columnAlign = getColumnAlign(column);
        const sortingModalAlignPoints = getTooltipSortAlignPoints(columnAlign);

        const getArrowPositions = () => {
            return calculateArrowPositions({
                width: columnWidth,
                align: columnAlign,
                index
            }, this.tableRef.state.scrollX, this.tableWrapRef);
        };

        const showSortBubble = () => {
            // workaround glitch with fixed-data-table-2
            // where header styles are overwritten first time user clicks on it
            this.scroll();

            this.setState({
                sortBubble: {
                    visible: true,
                    index
                }
            });
        };

        return props => (
            <span>
                <Cell {...props} className={cellClasses} onClick={showSortBubble}>
                    <span className="gd-table-header-title">
                        {column.title}
                    </span>
                    <span className={sort.sortDirClass} />
                </Cell>
                {this.isBubbleVisible(index) &&
                    <Bubble
                        closeOnOutsideClick
                        alignTo={`.${bubbleClass}`}
                        className="gd-table-header-bubble bubble-light"
                        overlayClassName="gd-table-header-bubble-overlay"
                        alignPoints={sortingModalAlignPoints}
                        arrowDirections={{
                            'bl tr': 'top',
                            'br tl': 'top',
                            'tl br': 'bottom',
                            'tr bl': 'bottom'
                        }}
                        arrowOffsets={{
                            'bl tr': [14, 10],
                            'br tl': [-14, 10],
                            'tl br': [14, -10],
                            'tr bl': [-14, -10]
                        }}
                        arrowStyle={getArrowPositions}
                        onClose={this.closeBubble}
                    >
                        <TableSortBubbleContent
                            activeSortDir={sort.dir}
                            title={column.title}
                            onClose={this.closeBubble}
                            onSortChange={this.getSortFunc(column, index)}
                        />
                    </Bubble>
                }
            </span>
        );
    }

    renderDefaultHeader(column, index) {
        const headerClasses = getHeaderClassNames(column);

        const sort = this.getSortObj(column, index);
        const sortFunc = this.getSortFunc(column, index);

        const onClick = e => sortFunc(sort.nextDir, e);
        const onMouseEnter = this.getMouseOverFunc(index);
        const onMouseLeave = this.getMouseOverFunc(null);

        const columnAlign = getColumnAlign(column);
        const tooltipAlignPoints = getTooltipAlignPoints(columnAlign);

        return props => (
            <Cell
                {...props}
                className={headerClasses}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                <BubbleHoverTrigger
                    className="gd-table-header-title"
                    showDelay={TOOLTIP_DISPLAY_DELAY}
                >
                    {column.title}
                    <Bubble
                        closeOnOutsideClick
                        className="bubble-light"
                        overlayClassName="gd-table-header-bubble-overlay"
                        alignPoints={tooltipAlignPoints}
                    >
                        {column.title}
                    </Bubble>
                </BubbleHoverTrigger>

                <span className={sort.sortDirClass} />
            </Cell>
        );
    }

    renderCell(columns, index) {
        const { rows, afm, drillableItems, onFiredDrillEvent } = this.props;
        const column = columns[index];
        const drillable = isDrillable(drillableItems, column);

        return (cellProps) => {
            const { rowIndex, columnKey } = cellProps;

            const row = rows[rowIndex];
            const content = row[columnKey];

            const classes = getCellClassNames(rowIndex, columnKey, drillable);
            const { style, label } = getStyledLabel(column, content);

            const drillConfig = { afm, onFiredDrillEvent };
            const hoverable = column.type === 'metric' && this.isTotalsEditAllowed();

            const cellPropsDrill = drillable ? assign({}, cellProps, {
                onClick(e) {
                    cellClick(
                        drillConfig,
                        {
                            columnIndex: columnKey,
                            rowIndex,
                            row,
                            intersection: [column]
                        },
                        e.target
                    );
                }
            }) : cellProps;

            const cellPropsHover = hoverable ? assign({}, cellPropsDrill, {
                onMouseEnter: () => this.toggleFooterColumnHighlight(true, index),
                onMouseLeave: () => this.toggleFooterColumnHighlight(false, index)
            }) : cellPropsDrill;

            return (
                <Cell {...cellPropsHover} className={classNames(`col-${index}`)}>
                    <span className={classes} style={style} title={label}>{label}</span>
                </Cell>
            );
        };
    }

    renderSumIcon(column, index, columnsCount) {
        const { totals, intl } = this.props;

        if (!isAddingMoreTotalsEnabled(totals)) {
            return null;
        }

        const dataSource = getTotalsDatasource(totals, intl);

        const isFirstColumn = (index === 0);
        const isLastColumn = (index === columnsCount - 1);
        const showSumIcon = !isFirstColumn && column.type === 'metric';

        const dropdownAlignPoint =
            isLastColumn ? { align: 'tc br', offset: { x: 24, y: -8 } } : { align: 'tc bc', offset: { x: 0, y: -8 } };

        const dropdownBodyClassName = classNames({
            'arrow-align-right': isLastColumn
        }, 'indigo-totals-select-type-list');

        const wrapperClassName = classNames({
            hide: !showSumIcon
        }, 'indigo-totals-add-row-button-wrap-a');

        const events = {
            onMouseEnter: () => {
                this.toggleBodyColumnHighlight(true, index);
                this.toggleFooterColumnHighlight(true, index);
            },
            onMouseLeave: () => {
                this.toggleBodyColumnHighlight(false, index);
                this.toggleFooterColumnHighlight(false, index);
            }
        };

        return (
            <div className={wrapperClassName}>
                <div className="indigo-totals-add-row-button-wrap-b" {...events}>
                    <div className="indigo-totals-add-row-button-wrap-c">
                        <Dropdown
                            onOpenStateChanged={(opened) => {
                                this.addTotalDropdownOpened = opened;
                                this.toggleBodyColumnHighlight(opened, index);
                                this.toggleFooterColumnHighlight(opened, index);
                            }}
                            alignPoints={[dropdownAlignPoint]}
                            button={
                                // TODO BB-334 Add final SUM icon
                                <Button
                                    className="s-totals-add-row indigo-totals-add-row-button button-link button-icon-only icon-circle-plus"
                                />
                            }
                            body={
                                <DropdownBody
                                    List={List}
                                    dataSource={dataSource}
                                    width={TOTALS_TYPES_DROPDOWN_WIDTH}
                                    className={dropdownBodyClassName}
                                    rowItem={
                                        <TableTotalsDropdownItem onSelect={item => this.addTotalsRow(item.type)} />
                                    }
                                />
                            }
                        />
                    </div>
                </div>
            </div>
        );
    }

    renderFooterEditCell(column, index, columnsCount) {
        if (!this.isTotalsEditAllowed()) {
            return null;
        }

        const style = { height: TOTALS_ADD_ROW_HEIGHT };

        const className = classNames('indigo-table-footer-cell', `col-${index}`, 'indigo-totals-add-cell');

        const events = {
            onMouseEnter: () => {
                this.toggleFooterColumnHighlight(true, index);
            },
            onMouseLeave: () => {
                this.toggleFooterColumnHighlight(false, index);
            }
        };

        return (
            <div className={className} style={style} {...events}>
                {this.renderSumIcon(column, index, columnsCount)}
            </div>
        );
    }

    renderFooter(column, index, columnsCount) {
        if (!this.hasFooter()) {
            return null;
        }

        const { totals } = this.props;

        const totalsWithData = getOrderedTotalsWithMockedData(totals);

        const isFirstColumn = (index === 0);

        const cellContent = totalsWithData.map((total, rowIndex) => {
            const value = total.values[index] === null ? '' : total.values[index];
            const className = classNames('indigo-table-footer-cell', `col-${index}`);
            const events = {
                onMouseEnter: () => {
                    this.resetTotalsRowHighlight(rowIndex);
                    this.toggleFooterColumnHighlight(true, index);
                },
                onMouseLeave: () => {
                    this.resetTotalsRowHighlight();
                    this.toggleFooterColumnHighlight(false, index);
                }
            };

            const { style, label } = getStyledLabel(column, value);
            const styleWithHeight = Object.assign({}, style, { height: DEFAULT_FOOTER_ROW_HEIGHT });

            return (
                <div {...events} key={uniqueId('footer-cell-')} className={className} style={styleWithHeight}>
                    <span>{isFirstColumn ? total.alias : label}</span>
                </div>
            );
        });

        return (
            <Cell>
                {cellContent}
                {this.renderFooterEditCell(column, index, columnsCount)}
            </Cell>
        );
    }

    renderColumns(columns, columnWidth) {
        const renderHeader = this.props.sortInTooltip ? this.renderTooltipHeader : this.renderDefaultHeader;

        return columns.map((column, index) => {
            return (
                <Column
                    key={`${index}.${column.id}`} // eslint-disable-line react/no-array-index-key
                    width={columnWidth}
                    align={getColumnAlign(column)}
                    columnKey={index}
                    header={renderHeader(column, index, columnWidth)}
                    footer={this.renderFooter(column, index, columns.length)}
                    cell={this.renderCell(columns, index)}
                    allowCellsRecycling
                />
            );
        });
    }

    renderTotalsRemove() {
        if (!this.isTotalsEditAllowed()) {
            return false;
        }

        const totals = getOrderedTotalsWithMockedData(this.props.totals);

        const rows = totals.map(total => (
            <div className="indigo-totals-remove-row" key={`totals-row-overlay-${total.type}`}>
                <Button
                    className={classNames(`s-totals-rows-remove-${total.type}`, 'indigo-totals-row-remove-button')}
                    onClick={() => { this.removeTotalsRow(total.type); }}
                />
            </div>
        ));

        const style = { bottom: `${TOTALS_ADD_ROW_HEIGHT}px` };

        return (
            <div className="indigo-totals-remove" style={style} ref={this.setTotalsRemoveRef}>
                {rows}
            </div>
        );
    }

    render() {
        const {
            headers,
            containerWidth,
            containerHeight,
            containerMaxHeight,
            afm,
            stickyHeader,
            totals,
            rows
        } = this.props;

        const enrichedHeaders = enrichTableDataHeaders(headers, afm);
        const columnWidth = Math.max(containerWidth / enrichedHeaders.length, MIN_COLUMN_WIDTH);
        const footerHeight = getFooterHeight(totals, this.isTotalsEditAllowed());
        const tableHeight = containerMaxHeight ? undefined : containerHeight;

        return (
            <div>
                <div className={this.getComponentClasses()}>
                    <div className={this.getContentClasses()} ref={this.setTableWrapRef}>
                        <Table
                            ref={this.setTableRef}
                            touchScrollEnabled
                            headerHeight={DEFAULT_HEADER_HEIGHT}
                            footerHeight={footerHeight}
                            rowHeight={DEFAULT_ROW_HEIGHT}
                            rowsCount={rows.length}
                            width={containerWidth}
                            maxHeight={containerMaxHeight}
                            height={tableHeight}
                            onScrollStart={this.closeBubble}
                        >
                            {this.renderColumns(enrichedHeaders, columnWidth)}
                        </Table>
                    </div>
                    {this.isSticky(stickyHeader) ? (
                        <div
                            className={'indigo-table-background-filler'}
                            style={{ ...pick(this.state, 'width', 'height') }}
                        />
                    ) : null}
                </div>
                {this.renderTotalsRemove()}
            </div>
        );
    }
}

export default injectIntl(TableVisualization);
