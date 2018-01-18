import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { injectIntl, intlShape } from 'react-intl';
import cx from 'classnames';
import { Cell, Column, Table } from 'fixed-data-table-2';
import { assign, debounce, isEqual, noop, pick, uniqueId } from 'lodash';
import 'nodelist-foreach-polyfill';

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
    toggleCellClass,
    resetRowClass,
    removeTotalsRow,
    addTotalsRow,
    updateTotalsRemovePosition,
    addMeasureIndex,
    removeMeasureIndex,
    getFirstMeasureIndex,
    getTotalsDefinition,
    shouldShowTotals
} from './Totals/utils';
import TotalCell from './Totals/TotalCell';
import { TotalsWithDataPropTypes } from '../proptypes/totals';

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
        totalsWithData: TotalsWithDataPropTypes,
        intl: intlShape.isRequired
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
        totalsWithData: []
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

        this.setRootRef = this.setRootRef.bind(this);
        this.setTableWrapRef = this.setTableWrapRef.bind(this);
        this.setTableComponentRef = this.setTableComponentRef.bind(this);
        this.closeBubble = this.closeBubble.bind(this);
        this.renderDefaultHeader = this.renderDefaultHeader.bind(this);
        this.renderTooltipHeader = this.renderTooltipHeader.bind(this);
        this.scroll = this.scroll.bind(this);
        this.scrolled = this.scrolled.bind(this);
        this.addTotalsRow = this.addTotalsRow.bind(this);
        this.setTotalsRemoveComponentRef = this.setTotalsRemoveComponentRef.bind(this);
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
        this.table = ReactDOM.findDOMNode(this.tableComponentRef); // eslint-disable-line react/no-find-dom-node
        this.tableInnerContainer = this.table.querySelector('.fixedDataTableLayout_rowsContainer');
        const tableRows = this.table.querySelectorAll('.fixedDataTableRowLayout_rowWrapper');

        this.header = tableRows[0];
        this.header.classList.add('table-header');

        if (this.hasFooterWithTotals()) {
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
        if (!isEqual(prevProps.totalsWithData, this.props.totalsWithData)) {
            const tableRows = this.table.querySelectorAll('.fixedDataTableRowLayout_rowWrapper');

            if (this.footer) {
                this.footer.classList.remove('table-footer');
            }

            if (this.hasFooterWithTotals()) {
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

    onTotalsEdit(totalsWithData) {
        const totalsDefinition = getTotalsDefinition(totalsWithData);

        this.props.onTotalsEdit(totalsDefinition);
    }

    setRootRef(ref) {
        this.rootRef = ref;
    }

    setTableComponentRef(ref) {
        this.tableComponentRef = ref;
    }

    setTableWrapRef(ref) {
        this.tableWrapRef = ref;
    }

    setTotalsRemoveComponentRef(ref) {
        this.totalsRemoveComponentRef = ref;
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

        return cx(
            'indigo-table-component',
            {
                'has-hidden-rows': hasHiddenRows,
                'has-footer': this.hasFooterWithTotals(),
                'has-footer-editable': this.isTotalsEditAllowed()
            });
    }

    getContentClasses() {
        const { stickyHeaderOffset } = this.props;

        return cx(
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
        resetRowClass(this.rootRef, 'indigo-totals-remove-row-highlight', '.indigo-totals-remove > .indigo-totals-remove-row', rowIndex);
    }

    hasFooterWithTotals() {
        const { headers, totalsWithData } = this.props;

        return this.isTotalsEditAllowed() || (totalsWithData.length && shouldShowTotals(headers));
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
        const { stickyHeaderOffset, sortInTooltip, totalsWithData, hasHiddenRows } = this.props;
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
            totalsWithData,
            tableBoundingRect.bottom,
            totalsEditAllowed
        );

        const positions = getHeaderPositions(
            stickyHeaderOffset,
            hasHiddenRows,
            totalsWithData,
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
        const { hasHiddenRows, totalsWithData } = this.props;
        const tableBoundingRect = this.tableInnerContainer.getBoundingClientRect();
        const totalsEditAllowed = this.isTotalsEditAllowed();

        const isOutOfViewport = tableBoundingRect.top > window.innerHeight;
        if (isOutOfViewport || !this.hasFooterWithTotals()) {
            return;
        }

        const isDefaultPosition = isFooterAtDefaultPosition(
            hasHiddenRows,
            tableBoundingRect.bottom,
            window.innerHeight
        );

        const isEdgePosition = isFooterAtEdgePosition(
            hasHiddenRows,
            totalsWithData,
            window.innerHeight,
            totalsEditAllowed,
            {
                height: tableBoundingRect.height,
                bottom: tableBoundingRect.bottom
            }
        );

        const positions = getFooterPositions(
            hasHiddenRows,
            totalsWithData,
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

        if (this.totalsRemoveComponentRef) {
            const wrapperRef = this.totalsRemoveComponentRef.getWrapperRef();
            updateTotalsRemovePosition(tableBoundingRect, totalsWithData, this.isTotalsEditAllowed(), wrapperRef);
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
        const { headers, totalsEditAllowed } = this.props;

        return totalsEditAllowed && shouldShowTotals(headers);
    }

    addTotalsRow(columnIndex, totalType) {
        const { totalsWithData, headers } = this.props;
        const totalsAddedRow = addTotalsRow(totalsWithData, totalType);
        const totalsEnabledColumn = addMeasureIndex(totalsAddedRow, headers, totalType, columnIndex);

        if (!isEqual(totalsEnabledColumn, totalsWithData)) {
            this.onTotalsEdit(totalsEnabledColumn);
        }
    }

    removeTotalsRow(totalType) {
        const updatedTotals = removeTotalsRow(this.props.totalsWithData, totalType);

        this.onTotalsEdit(updatedTotals);
    }

    enableTotalColumn(columnIndex, totalType) {
        const updatedTotals = addMeasureIndex(this.props.totalsWithData, this.props.headers, totalType, columnIndex);

        this.onTotalsEdit(updatedTotals);
    }

    disableTotalColumn(columnIndex, totalType) {
        const updatedTotals = removeMeasureIndex(this.props.totalsWithData, this.props.headers, totalType, columnIndex);

        this.onTotalsEdit(updatedTotals);
    }

    renderTooltipHeader(header, columnIndex, columnWidth) {
        const headerClasses = getHeaderClassNames(header);
        const bubbleClass = uniqueId('table-header-');
        const cellClasses = cx(headerClasses, bubbleClass);

        const sort = this.getSortObj(header, columnIndex);

        const columnAlign = getColumnAlign(header);
        const sortingModalAlignPoints = getTooltipSortAlignPoints(columnAlign);

        const getArrowPositions = () => {
            return TableVisualization.fullscreenTooltipEnabled()
                ? calculateArrowPositions(
                    {
                        width: columnWidth,
                        align: columnAlign,
                        index: columnIndex
                    },
                    this.tableComponentRef.state.scrollX,
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
                    index: columnIndex
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
                {this.isBubbleVisible(columnIndex) &&
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

    renderDefaultHeader(header, columnIndex) {
        const headerClasses = getHeaderClassNames(header);
        const onMouseEnter = this.getMouseOverFunc(columnIndex);
        const onMouseLeave = this.getMouseOverFunc(null);
        const sort = this.getSortObj(header, columnIndex);
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

    renderCell(headers, columnIndex) {
        const { executionRequest, drillableItems, onFiredDrillEvent, rows } = this.props;
        const { afm } = executionRequest;
        const header = headers[columnIndex];
        const drillable = isDrillable(drillableItems, header, afm);

        return (cellProps) => {
            const { rowIndex, columnKey } = cellProps;
            const row = rows[rowIndex];
            const cellContent = row[columnKey];
            const classes = getCellClassNames(rowIndex, columnKey, drillable);
            const drillConfig = { afm, onFiredDrillEvent };
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
                            intersection: [getBackwardCompatibleHeaderForDrilling(afm, header)]
                        },
                        e.target
                    );
                }
            }) : cellProps;

            const cellPropsHover = hoverable ? assign({}, cellPropsDrill, {
                onMouseEnter: () => this.toggleFooterColumnHighlight(columnIndex, true),
                onMouseLeave: () => this.toggleFooterColumnHighlight(columnIndex, false)
            }) : cellPropsDrill;

            return (
                <Cell {...cellPropsHover} className={cx(`col-${columnIndex}`)}>
                    <span className={classes} style={style} title={label}>{label}</span>
                </Cell>
            );
        };
    }

    renderFooter(header, columnIndex, headersCount) {
        const { headers, totalsWithData } = this.props;

        if (!shouldShowTotals(headers)) {
            return null;
        }

        return (
            <TotalCell
                totalsWithData={totalsWithData}
                columnIndex={columnIndex}
                header={header}
                headersCount={headersCount}
                firstMeasureIndex={getFirstMeasureIndex(headers)}
                editAllowed={this.isTotalsEditAllowed()}
                onCellMouseEnter={(rowIndex, colIndex) => {
                    this.resetTotalsRowHighlight(rowIndex);
                    this.toggleFooterColumnHighlight(colIndex, true);
                }}
                onCellMouseLeave={(rowIndex, colIndex) => {
                    this.resetTotalsRowHighlight();
                    this.toggleFooterColumnHighlight(colIndex, false);
                }}
                onEnableColumn={this.enableTotalColumn}
                onDisableColumn={this.disableTotalColumn}
                onAddDropdownOpenStateChanged={(colIndex, isOpened) => {
                    this.addTotalDropdownOpened = isOpened;
                    this.toggleBodyColumnHighlight(colIndex, isOpened);
                    this.toggleFooterColumnHighlight(colIndex, isOpened);
                }}
                onAddWrapperHover={(colIndex, isHighlighted) => {
                    this.toggleFooterColumnHighlight(colIndex, isHighlighted);
                }}
                onAddButtonHover={(colIndex, isHovered) => {
                    this.toggleBodyColumnHighlight(colIndex, isHovered);
                    this.toggleFooterColumnHighlight(colIndex, isHovered);
                }}
                onRowAdd={this.addTotalsRow}
            />
        );
    }

    renderColumns(headers, columnWidth) {
        const renderHeader = this.props.sortInTooltip ? this.renderTooltipHeader : this.renderDefaultHeader;

        return headers.map((header, columnIndex) => (
            <Column
                key={`${columnIndex}.${header.localIdentifier}`} // eslint-disable-line react/no-array-index-key
                width={columnWidth}
                align={getColumnAlign(header)}
                columnKey={columnIndex}
                header={renderHeader(header, columnIndex, columnWidth)}
                footer={this.renderFooter(header, columnIndex, headers.length)}
                cell={this.renderCell(headers, columnIndex)}
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

        return (
            <RemoveRows
                totalsWithData={this.props.totalsWithData}
                onRemove={this.removeTotalsRow}
                ref={this.setTotalsRemoveComponentRef}
            />
        );
    }

    render() {
        const {
            totalsWithData,
            containerHeight,
            containerMaxHeight,
            containerWidth,
            headers,
            stickyHeaderOffset
        } = this.props;

        const height = containerMaxHeight ? undefined : containerHeight;
        const footerHeight = getFooterHeight(totalsWithData, this.isTotalsEditAllowed());
        const columnWidth = Math.max(containerWidth / headers.length, MIN_COLUMN_WIDTH);
        const isSticky = TableVisualization.isSticky(stickyHeaderOffset);

        return (
            <div ref={this.setRootRef}>
                <div className={this.getComponentClasses()}>
                    <div className={this.getContentClasses()} ref={this.setTableWrapRef}>
                        <Table
                            ref={this.setTableComponentRef}
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
