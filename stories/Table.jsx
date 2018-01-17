import React from 'react';
import { storiesOf, action } from '@storybook/react';
import { range } from 'lodash';
import { screenshotWrap } from '@gooddata/test-storybook';

import TableTransformation from '../src/Table/TableTransformation';
import ResponsiveTable from '../src/Table/ResponsiveTable';
import IntlWrapper from './utils/IntlWrapper';
import '../src/styles/table.scss';

import {
    EXECUTION_REQUEST_2A_1M,
    EXECUTION_RESPONSE_2A_1M,
    EXECUTION_RESULT_2A_1M
} from '../src/Table/fixtures/2attributes1measure';
import {
    EXECUTION_REQUEST_2A_3M, EXECUTION_RESPONSE_2A_3M,
    EXECUTION_RESULT_2A_3M
} from '../src/Table/fixtures/2attributes3measures';

function generateExecutionRequest() {
    // no needed exact executionRequest for these storybook usages where is no sorting
    return {
        afm: {},
        resultSpec: {}
    };
}

function generateAttributeUriForColumn(rowNumber) {
    return `/gdc/md/project_id/obj/attr_${rowNumber}_uri_id`;
}

function generateAttributeDisplayFormUriForColumn(rowNumber) {
    return `${generateAttributeUriForColumn(rowNumber)}_df`;
}

function generateAttributeHeaders(columns) {
    return range(columns).map((columnNumber) => {
        return {
            attributeHeader: {
                uri: generateAttributeDisplayFormUriForColumn(columnNumber),
                identifier: `identifier_${columnNumber}`,
                localIdentifier: `df_local_identifier_${columnNumber}`,
                name: `Column DF ${columnNumber}`,
                formOf: {
                    name: `Column ${columnNumber}`,
                    uri: generateAttributeUriForColumn(columnNumber),
                    identifier: `local_identifier_${columnNumber}`
                }
            }
        };
    });
}

function generateHeaderItems(columns, rows) {
    return [
        range(columns).map((columnNumber) => {
            return range(rows).map((rowNumber) => {
                return {
                    attributeHeaderItem: {
                        uri: `${generateAttributeDisplayFormUriForColumn(columnNumber)}/elements?id=${rowNumber}`,
                        name: columnNumber.toString()
                    }
                };
            });
        }),
        [] // empty array => empty 1-st dimension
    ];
}

function generateExecutionResponse(columns, rows) {
    return {
        dimensions: [
            {
                headers: generateAttributeHeaders(columns, rows)
            },
            {
                headers: [] // empty array => empty 1-st dimension
            }
        ],
        links: {
            executionResult: '/gdc/app/projects/project_id/executionResults/foo?q=bar&c=baz&dimension=a&dimension=m'
        }
    };
}

function generateExecutionResult(columns, rows) {
    return {
        data: [],
        headerItems: generateHeaderItems(columns, rows),
        paging: {
            count: [
                20,
                1
            ],
            offset: [
                0,
                0
            ],
            total: [
                20,
                1
            ]
        }
    };
}

function generateTotals(totalsTypes) {
    return totalsTypes.map((type, index) => {
        return {
            type,
            alias: index === 0 ? `My ${type}` : undefined,
            outputMeasureIndexes: [index]
        };
    });
}

storiesOf('Table', module)
    .add('Fixed dimensions', () => (
        screenshotWrap(
            <IntlWrapper>
                <div>
                    <TableTransformation
                        executionRequest={EXECUTION_REQUEST_2A_1M}
                        executionResponse={EXECUTION_RESPONSE_2A_1M}
                        executionResult={EXECUTION_RESULT_2A_1M}
                        height={400}
                        onSortChange={action('Sort changed')}
                        width={600}
                    />
                </div>
            </IntlWrapper>
        )
    ))
    .add('Fill parent', () => (
        screenshotWrap(
            <IntlWrapper>
                <div style={{ width: '100%', height: 500 }}>
                    <TableTransformation
                        executionRequest={EXECUTION_REQUEST_2A_1M}
                        executionResponse={EXECUTION_RESPONSE_2A_1M}
                        executionResult={EXECUTION_RESULT_2A_1M}
                        onSortChange={action('Sort changed')}
                    />
                </div>
            </IntlWrapper>
        )
    ))
    .add('Sticky header', () => (
        screenshotWrap(
            <IntlWrapper>
                <div style={{ width: '100%', height: 600 }}>
                    <TableTransformation
                        config={{
                            stickyHeader: 0
                        }}
                        executionRequest={EXECUTION_REQUEST_2A_1M}
                        executionResponse={EXECUTION_RESPONSE_2A_1M}
                        executionResult={EXECUTION_RESULT_2A_1M}
                        height={400}
                        onSortChange={action('Sort changed')}
                    />
                    <div style={{ height: 800 }} />
                </div>
            </IntlWrapper>
        )
    ))
    .add('Vertical scroll', () => (
        screenshotWrap(
            <IntlWrapper>
                <div>
                    <TableTransformation
                        executionRequest={generateExecutionRequest()}
                        executionResponse={generateExecutionResponse(20, 20)}
                        executionResult={generateExecutionResult(20, 20)}
                        height={400}
                        onSortChange={action('Sort changed')}
                        width={600}
                    />
                </div>
            </IntlWrapper>
        )
    ))
    .add('Show more/Show less', () => (
        screenshotWrap(
            <IntlWrapper>
                <TableTransformation
                    config={{
                        onMore: action('More clicked'),
                        onLess: action('Less clicked')
                    }}
                    executionRequest={generateExecutionRequest()}
                    executionResponse={generateExecutionResponse(20, 20)}
                    executionResult={generateExecutionResult(20, 20)}
                    height={400}
                    onSortChange={action('Sort changed')}
                    tableRenderer={props => (<ResponsiveTable {...props} rowsPerPage={10} />)}
                />
            </IntlWrapper>
        )
    ))
    .add('Totals view mode', () => (
        screenshotWrap(
            <IntlWrapper>
                <TableTransformation
                    config={{
                        onMore: action('More clicked'),
                        onLess: action('Less clicked'),
                        stickyHeaderOffset: 0
                    }}
                    executionRequest={EXECUTION_REQUEST_2A_3M}
                    executionResponse={EXECUTION_RESPONSE_2A_3M}
                    executionResult={EXECUTION_RESULT_2A_3M}
                    height={400}
                    onSortChange={action('Sort changed')}
                    tableRenderer={props => (<ResponsiveTable {...props} rowsPerPage={10} />)}
                    totals={generateTotals(['avg', 'nat', 'sum'])}
                />
            </IntlWrapper>
        )
    ))
    .add('Totals edit mode', () => {
        let tableRef;
        const totals = generateTotals(['avg', 'nat', 'sum']);

        return screenshotWrap(
            <IntlWrapper>
                <TableTransformation
                    ref={(ref) => { tableRef = ref; }}
                    executionRequest={EXECUTION_REQUEST_2A_3M}
                    executionResponse={EXECUTION_RESPONSE_2A_3M}
                    executionResult={EXECUTION_RESULT_2A_3M}
                    height={400}
                    onSortChange={action('Sort changed')}
                    totalsEditAllowed
                    totals={totals}
                    onTotalsEdit={(updateTotals) => {
                        action('Totals updated')(updateTotals);
                        while (totals.length) totals.pop();
                        updateTotals.forEach(t => totals.push(t));
                        tableRef.forceUpdate();
                    }}
                />
            </IntlWrapper>
        );
    });
