import React from 'react';
import { storiesOf, action } from '@storybook/react';
import { range } from 'lodash';

import TableTransformation from '../src/Table/TableTransformation';
import ResponsiveTable from '../src/Table/ResponsiveTable';
import IntlWrapper from './utils/IntlWrapper';
import { screenshotWrap } from './utils/wrap';

import * as TestConfig from './test_data/test_config';
import * as TestData from './test_data/test_data';
import '../src/styles/table.scss';

function generateData(columns, rows) {
    const headers = range(columns)
        .map((i) => {
            return {
                type: 'attrLabel',
                id: i,
                title: `Column ${i}`
            };
        });
    const rawData = range(rows)
        .map(() => {
            return range(columns).map(i => ({ id: i, name: i }));
        });

    return {
        headers,
        rawData
    };
}

function generateTotals(columns, totalsTypes) {
    return totalsTypes.map((type, typeIndex) => {
        return {
            type,
            alias: `My ${type}`,
            values: range(columns).map((column, columnIndex) => typeIndex + columnIndex)
        };
    });
}

storiesOf('Table')
    .add('Fixed dimensions', () => (
        screenshotWrap(
            <IntlWrapper>
                <div>
                    <TableTransformation
                        config={TestConfig.table}
                        data={TestData.stackedBar}
                        onSortChange={action('Sort changed')}
                        width={600}
                        height={400}
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
                        config={TestConfig.table}
                        data={TestData.stackedBar}
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
                            ...TestConfig.table,
                            stickyHeader: 0
                        }}
                        data={TestData.stackedBar}
                        height={400}
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
                        config={TestConfig.table}
                        data={generateData(20, 20)}
                        width={600}
                        height={400}
                    />
                </div>
            </IntlWrapper>
        )
    ))
    .add('Show more/Show less', () => (
        screenshotWrap(
            <IntlWrapper>
                <TableTransformation
                    tableRenderer={props => (<ResponsiveTable {...props} />)}
                    config={{
                        ...TestConfig.table,
                        onMore: action('More clicked'),
                        onLess: action('Less clicked')
                    }}
                    data={generateData(20, 20)}
                    height={400}
                />
            </IntlWrapper>
        )
    ))
    .add('Totals view mode', () => (
        screenshotWrap(
            <IntlWrapper>
                <TableTransformation
                    totals={generateTotals(3, ['sum', 'avg', 'nat'])}
                    config={TestConfig.table}
                    data={TestData.stackedBar}
                    height={400}
                />
            </IntlWrapper>
        )
    ))
    .add('Totals edit mode', () => (
        screenshotWrap(
            <IntlWrapper>
                <TableTransformation
                    totalsEditAllowed
                    totals={generateTotals(3, ['sum', 'avg', 'nat'])}
                    onTotalsEdit={action('Totals updated')}
                    config={TestConfig.table}
                    data={TestData.stackedBar}
                    height={400}
                />
            </IntlWrapper>
        )
    ));
