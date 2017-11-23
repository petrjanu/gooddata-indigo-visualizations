import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { injectIntl } from 'react-intl';
import classNames from 'classnames';
import { Cell, Column, Table } from 'fixed-data-table-2';
import { assign, debounce, isEqual, noop, pick, uniqueId } from 'lodash';

import Bubble from '@gooddata/goodstrap/lib/Bubble/Bubble';
import BubbleHoverTrigger from '@gooddata/goodstrap/lib/Bubble/BubbleHoverTrigger';

import TableSortBubbleContent from './TableSortBubbleContent';
import DrillableItem from '../proptypes/DrillableItem';
import { ExecutionRequestPropTypes } from '../proptypes/execution';
import { subscribeEvents } from '../utils/common';
import { getCellClassNames, getColumnAlign, getStyledLabel } from './utils/cell';
import { getBackwardCompatibleHeaderForDrilling, getBackwardCompatibleRowForDrilling } from './utils/dataTransformation';
import { cellClick, isDrillable } from '../utils/drilldownEventing';
import RemoveRows from './Totals/RemoveRows';
import { getHeaderSortClassName, getNextSortDir } from './utils/sort';
import { getFooterHeight, getFooterPositions, isFooterAtDefaultPosition, isFooterAtEdgePosition } from './utils/footer';
import { updatePosition } from './utils/row';
import {
    calculateArrowPositions,
    getHeaderClassNames, getHeaderPositions,
    getTooltipAlignPoints,
    getTooltipSortAlignPoints, isHeaderAtDefaultPosition, isHeaderAtEdgePosition
} from './utils/header';
import {
    getOrderedTotalsWithMockedData,
    toggleCellClass,
    resetRowClass,
    removeTotalsRow,
    addTotalsRow,
    updateTotalsRemovePosition,
    addMeasureIndex,
    removeMeasureIndex, getFirstMeasureIndex
} from './Totals/utils';
import TotalCell from './Totals/TotalCells';

const FULLSCREEN_TOOLTIP_VIEWPORT_THRESHOLD = 480;
const MIN_COLUMN_WIDTH = 100;

export const DEFAULT_HEADER_HEIGHT = 26;
export const DEFAULT_ROW_HEIGHT = 30;
export const DEFAULT_FOOTER_ROW_HEIGHT = 30;

export const TOTALS_ADD_ROW_HEIGHT = 50;
export const TOTALS_TYPES_DROPDOWN_WIDTH = 150;

const DEBOUNCE_SCROLL_STOP = 500;
const TOOLTIP_DISPLAY_DELAY = 1000;

export const SCROLL_DEBOUNCE = 0;
export const RESIZE_DEBOUNCE = 60;

const scrollEvents = [
    {
        name: 'scroll',
        debounce: SCROLL_DEBOUNCE
    }, {
        name: 'goodstrap.scrolled',
        debounce: SCROLL_DEBOUNCE
    }, {
        name: 'resize',
        debounce: RESIZE_DEBOUNCE
    }, {
        name: 'goodstrap.drag',
        debounce: RESIZE_DEBOUNCE
    }
];

export const totalShape = PropTypes.shape({
    alias: PropTypes.string,
    type: PropTypes.string,
    outputMeasureIndexes: PropTypes.arrayOf(PropTypes.number)
});

export const totalsPropType = {
    totals: PropTypes.arrayOf(totalShape)
};

export const totalsDefaultProp = {
    totals: []
};

export class TableVisualization extends Component {
    static propTypes = {
        afterRender: PropTypes.func,
        containerHeight: PropTypes.number,
        containerMaxHeight: PropTypes.number,
        containerWidth: PropTypes.number.isRequired,
        drillableItems: PropTypes.arrayOf(PropTypes.shape(DrillableItem)),
        executionRequest: ExecutionRequestPropTypes.isRequired,
        hasHiddenRows: PropTypes.bool,
        headers: PropTypes.array,
        onFiredDrillEvent: PropTypes.func,
        onSortChange: PropTypes.func,
        rows: PropTypes.array,
        sortBy: PropTypes.number,
        sortDir: PropTypes.string,
        sortInTooltip: PropTypes.bool,
        stickyHeaderOffset: PropTypes.number,
        totalsEditAllowed: PropTypes.bool,
        onTotalsEdit: PropTypes.func,
        ...totalsPropType
    };

    static defaultProps = {
        afterRender: noop,
        containerHeight: null,
        containerMaxHeight: null,
        drillableItems: [],
        hasHiddenRows: false,
        headers: [],
        onFiredDrillEvent: noop,
        onSortChange: noop,
        rows: [],
        sortBy: null,
        sortDir: null,
        sortInTooltip: false,
        stickyHeaderOffset: -1,
        totalsEditAllowed: false,
        onTotalsEdit: noop,
        ...totalsDefaultProp
    };

    static fullscreenTooltipEnabled() {
        return document.documentElement.clientWidth <= FULLSCREEN_TOOLTIP_VIEWPORT_THRESHOLD;
    }

    static isSticky(stickyHeaderOffset) {
        return stickyHeaderOffset >= 0;
    }

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

        this.setTableWrapRef = this.setTableWrapRef.bind(this);
        this.setTableRef = this.setTableRef.bind(this);
        this.closeBubble = this.closeBubble.bind(this);
        this.renderDefaultHeader = this.renderDefaultHeader.bind(this);
        this.renderTooltipHeader = this.renderTooltipHeader.bind(this);
        this.scroll = this.scroll.bind(this);
        this.scrolled = this.scrolled.bind(this);
        this.addTotalsRow = this.addTotalsRow.bind(this);
        this.setTotalsRemoveRef = this.setTotalsRemoveRef.bind(this);
        this.removeTotalsRow = this.removeTotalsRow.bind(this);
        this.toggleColumnHighlight = this.toggleColumnHighlight.bind(this);
        this.toggleBodyColumnHighlight = this.toggleBodyColumnHighlight.bind(this);
        this.toggleFooterColumnHighlight = this.toggleFooterColumnHighlight.bind(this);
        this.resetTotalsRowHighlight = this.resetTotalsRowHighlight.bind(this);
        this.enableTotalColumn = this.enableTotalColumn.bind(this);
        this.disableTotalColumn = this.disableTotalColumn.bind(this);

        this.scrollingStopped = debounce(() => this.scroll(true), DEBOUNCE_SCROLL_STOP);

        this.addTotalDropdownOpened = false;
    }

    componentDidMount() {
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

        if (TableVisualization.isSticky(this.props.stickyHeaderOffset)) {
            this.setListeners();
            this.scrolled();
            this.checkTableDimensions();
        }
    }

    componentWillReceiveProps(nextProps) {
        const current = this.props;
        const currentIsSticky = TableVisualization.isSticky(current.stickyHeaderOffset);
        const nextIsSticky = TableVisualization.isSticky(nextProps.stickyHeaderOffset);

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
        const totalsWithData = getOrderedTotalsWithMockedData(this.props.totals);
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

        if (TableVisualization.isSticky(this.props.stickyHeaderOffset)) {
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

    getSortFunc(header, sort) {
        const { onSortChange } = this.props;

        const sortItem = header.type === 'attribute'
            ? {
                attributeSortItem: {
                    direction: sort.nextDir,
                    attributeIdentifier: header.localIdentifier
                }
            }
            : {
                measureSortItem: {
                    direction: sort.nextDir,
                    locators: [
                        {
                            measureLocatorItem: {
                                measureIdentifier: header.localIdentifier
                            }
                        }
                    ]
                }
            };

        return onSortChange(sortItem);
    }

    getSortObj(header, index) {
        const { sortBy, sortDir } = this.props;
        const { hintSortBy } = this.state;

        const dir = (sortBy === index ? sortDir : null);
        const nextDir = getNextSortDir(header, dir);

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
        const { stickyHeaderOffset } = this.props;

        return classNames(
            'indigo-table-component-content',
            {
                'has-sticky-header': TableVisualization.isSticky(stickyHeaderOffset)
            });
    }

    unsetListeners() {
        if (this.subscribers && this.subscribers.length > 0) {
            this.subscribers.forEach((subscriber) => {
                subscriber.unsubscribe();
            });
            this.subscribers = null;
        }
    }

    toggleBodyColumnHighlight(columnIndex, isHighlighted) {
        if (this.addTotalDropdownOpened) {
            return;
        }
        toggleCellClass(this.table, columnIndex, isHighlighted, 'indigo-table-cell-highlight');
    }

    toggleFooterColumnHighlight(columnIndex, isHighlighted) {
        if (this.addTotalDropdownOpened) {
            return;
        }
        toggleCellClass(this.footer, columnIndex, isHighlighted, 'indigo-table-footer-cell-highlight');
    }

    toggleColumnHighlight(columnIndex, isHighlighted) {
        this.toggleBodyColumnHighlight(columnIndex, isHighlighted);
        this.toggleFooterColumnHighlight(columnIndex, isHighlighted);
    }

    resetTotalsRowHighlight(rowIndex) {
        if (!this.isTotalsEditAllowed()) {
            return;
        }
        resetRowClass(this.component, 'indigo-totals-remove-row-highlight', '.indigo-totals-remove > .indigo-totals-remove-row', rowIndex);
    }

    hasFooter() {
        if (this.isTotalsEditAllowed()) {
            return true;
        }

        const { headers, totals, rows } = this.props;

        const onlyMeasures = headers.every(header => header.type === 'measure');
        const totalRowsCount = totals.length;
        const rowsCount = rows.length;

        return rowsCount > 1 && totalRowsCount > 0 && !onlyMeasures;
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
        const { stickyHeaderOffset, sortInTooltip, totals, hasHiddenRows } = this.props;
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
            stickyHeaderOffset,
            tableBoundingRect.top
        );

        const isEdgePosition = isHeaderAtEdgePosition(
            stickyHeaderOffset,
            hasHiddenRows,
            totals,
            tableBoundingRect.bottom,
            totalsEditAllowed
        );

        const positions = getHeaderPositions(
            stickyHeaderOffset,
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

        if (this.totalsRemoveRef) {
            const wrapperRef = this.totalsRemoveRef.getWrapperRef();
            updateTotalsRemovePosition(tableBoundingRect, totals, this.isTotalsEditAllowed(), wrapperRef);
        }
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

    isTotalsEditAllowed() {
        return this.props.totalsEditAllowed;
    }

    addTotalsRow(totalItemType) {
        const updatedTotals = addTotalsRow(this.props.intl, this.props.totals, totalItemType);

        if (!isEqual(updatedTotals, this.props.totals)) {
            this.props.onTotalsEdit(updatedTotals);
        }
    }

    removeTotalsRow(totalItemType) {
        const totals = removeTotalsRow(this.props.totals, totalItemType);

        this.props.onTotalsEdit(totals);
    }

    enableTotalColumn(totalType, columnIndex) {
        const updatedTotals = addMeasureIndex(this.props.totals, this.props.headers, totalType, columnIndex);

        this.props.onTotalsEdit(updatedTotals);
    }

    disableTotalColumn(totalType, columnIndex) {
        const updatedTotals = removeMeasureIndex(this.props.totals, this.props.headers, totalType, columnIndex);

        this.props.onTotalsEdit(updatedTotals);
    }

    renderTooltipHeader(header, index, columnWidth) {
        const headerClasses = getHeaderClassNames(header);
        const bubbleClass = uniqueId('table-header-');
        const cellClasses = classNames(headerClasses, bubbleClass);

        const sort = this.getSortObj(header, index);

        const columnAlign = getColumnAlign(header);
        const sortingModalAlignPoints = getTooltipSortAlignPoints(columnAlign);

        const getArrowPositions = () => {
            return TableVisualization.fullscreenTooltipEnabled()
                ? calculateArrowPositions(
                    {
                        width: columnWidth,
                        align: columnAlign,
                        index
                    },
                    this.tableRef.state.scrollX,
                    this.tableWrapRef
                )
                : null;
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
                        {header.name}
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
                        title={header.name}
                        onClose={this.closeBubble}
                        onSortChange={this.getSortFunc(header, sort)}
                    />
                </Bubble>
                }
            </span>
        );
    }

    renderDefaultHeader(header, index) {
        const headerClasses = getHeaderClassNames(header);
        const onMouseEnter = this.getMouseOverFunc(index);
        const onMouseLeave = this.getMouseOverFunc(null);
        const sort = this.getSortObj(header, index);
        const onClick = () => this.getSortFunc(header, sort);

        const columnAlign = getColumnAlign(header);
        const tooltipAlignPoints = getTooltipAlignPoints(columnAlign);

        return props => (
            <Cell
                {...props}
                className={headerClasses}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                <BubbleHoverTrigger className="gd-table-header-title" showDelay={TOOLTIP_DISPLAY_DELAY}>
                    {header.name}
                    <Bubble
                        closeOnOutsideClick
                        className="bubble-light"
                        overlayClassName="gd-table-header-bubble-overlay"
                        alignPoints={tooltipAlignPoints}
                    >
                        {header.name}
                    </Bubble>
                </BubbleHoverTrigger>
                <span className={sort.sortDirClass} />
            </Cell>
        );
    }

    renderCell(headers, index) {
        const { executionRequest, drillableItems, onFiredDrillEvent, rows } = this.props;
        const header = headers[index];
        const drillable = isDrillable(drillableItems, header);

        return (cellProps) => {
            const { rowIndex, columnKey } = cellProps;
            const row = rows[rowIndex];
            const cellContent = row[columnKey];
            const classes = getCellClassNames(rowIndex, columnKey, drillable);
            const drillConfig = { executionRequest, onFiredDrillEvent };
            const hoverable = header.type === 'measure' && this.isTotalsEditAllowed();
            const { style, label } = getStyledLabel(header, cellContent);

            const cellPropsDrill = drillable ? assign({}, cellProps, {
                onClick(e) {
                    cellClick(
                        drillConfig,
                        {
                            columnIndex: columnKey,
                            rowIndex,
                            row: getBackwardCompatibleRowForDrilling(row),
                            intersection: [getBackwardCompatibleHeaderForDrilling(header)]
                        },
                        e.target
                    );
                }
            }) : cellProps;

            const cellPropsHover = hoverable ? assign({}, cellPropsDrill, {
                onMouseEnter: () => this.toggleFooterColumnHighlight(index, true),
                onMouseLeave: () => this.toggleFooterColumnHighlight(index, false)
            }) : cellPropsDrill;

            return (
                <Cell {...cellPropsHover} className={classNames(`col-${index}`)}>
                    <span className={classes} style={style} title={label}>{label}</span>
                </Cell>
            );
        };
    }

    renderFooter(header, index, headersCount) {
        if (!this.hasFooter()) {
            return null;
        }

        return (
            <TotalCell
                totals={this.props.totals}
                columnIndex={index}
                header={header}
                headersCount={headersCount}
                firstMeasureIndex={getFirstMeasureIndex(this.props.headers)}
                editAllowed={this.isTotalsEditAllowed()}
                onCellMouseEnter={(rowIndex, columnIndex) => {
                    this.resetTotalsRowHighlight(rowIndex);
                    this.toggleFooterColumnHighlight(columnIndex, true);
                }}
                onCellMouseLeave={(rowIndex, columnIndex) => {
                    this.resetTotalsRowHighlight();
                    this.toggleFooterColumnHighlight(columnIndex, false);
                }}
                onEnableColumn={this.enableTotalColumn}
                onDisableColumn={this.disableTotalColumn}
                onAddDropdownOpenStateChanged={(columnIndex, isOpened) => {
                    this.addTotalDropdownOpened = isOpened;
                    this.toggleBodyColumnHighlight(columnIndex, isOpened);
                    this.toggleFooterColumnHighlight(columnIndex, isOpened);
                }}
                onAddWrapperHover={(columnIndex, isHighlighted) => {
                    this.toggleFooterColumnHighlight(columnIndex, isHighlighted);
                }}
                onAddButtonHover={(columnIndex, isHovered) => {
                    this.toggleBodyColumnHighlight(columnIndex, isHovered);
                    this.toggleFooterColumnHighlight(columnIndex, isHovered);
                }}
                onRowAdd={this.addTotalsRow}
            />
        );
    }

    renderColumns(headers, columnWidth) {
        const renderHeader = this.props.sortInTooltip ? this.renderTooltipHeader : this.renderDefaultHeader;

        return headers.map((header, index) => (
            <Column
                key={`${index}.${header.localIdentifier}`} // eslint-disable-line react/no-array-index-key
                width={columnWidth}
                align={getColumnAlign(header)}
                columnKey={index}
                header={renderHeader(header, index, columnWidth)}
                footer={this.renderFooter(header, index, headers.length)}
                cell={this.renderCell(headers, index)}
                allowCellsRecycling
            />
        ));
    }

    renderStickyTableBackgroundFiller() {
        return (
            <div
                className="indigo-table-background-filler"
                style={{ ...pick(this.state, 'width', 'height') }}
            />
        );
    }

    renderTotalsRemove() {
        if (!this.isTotalsEditAllowed()) {
            return false;
        }

        const totals = getOrderedTotalsWithMockedData(this.props.totals);

        return (
            <RemoveRows
                totals={totals}
                onRemove={this.removeTotalsRow}
                ref={this.setTotalsRemoveRef}
            />
        );
    }

    render() {
        const {
            totals,
            containerHeight,
            containerMaxHeight,
            containerWidth,
            headers,
            stickyHeaderOffset
        } = this.props;

        const height = containerMaxHeight ? undefined : containerHeight;
        const footerHeight = getFooterHeight(totals, this.isTotalsEditAllowed());
        const columnWidth = Math.max(containerWidth / headers.length, MIN_COLUMN_WIDTH);
        const isSticky = TableVisualization.isSticky(stickyHeaderOffset);

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
                            rowsCount={this.props.rows.length}
                            width={containerWidth}
                            maxHeight={containerMaxHeight}
                            height={height}
                            onScrollStart={this.closeBubble}
                        >
                            {this.renderColumns(headers, columnWidth)}
                        </Table>
                    </div>
                    {isSticky ? this.renderStickyTableBackgroundFiller() : false}
                </div>
                {this.renderTotalsRemove()}
            </div>
        );
    }
}

export default injectIntl(TableVisualization);
