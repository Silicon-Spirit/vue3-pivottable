import { PivotData } from "./helper/utils";
import defaultProps from "./helper/defaultProps";
import * as Vue from "vue";

function redColorScaleGenerator(values) {
	const min = Math.min.apply(Math, values);
	const max = Math.max.apply(Math, values);
	return (x) => {
		// eslint-disable-next-line no-magic-numbers
		const nonRed = 255 - Math.round((255 * (x - min)) / (max - min));
		return { backgroundColor: `rgb(255,${nonRed},${nonRed})` };
	};
}

function makeRenderer(opts = {}) {
	const TableRenderer = {
		name: opts.name,
		props: {
			mode: String,
			tableColorScaleGenerator: {
				type: Function,
				default: redColorScaleGenerator,
			},
			tableOptions: {
				type: Object,
				default: function () {
					return {};
				},
			},
			...defaultProps.props,
		},
		methods: {
			spanSize(arr, i, j) {
				// helper function for setting row/col-span in pivotTableRenderer
				let x;
				if (i !== 0) {
					let asc, end;
					let noDraw = true;
					for (
						x = 0, end = j, asc = end >= 0;
						asc ? x <= end : x >= end;
						asc ? x++ : x--
					) {
						if (arr[i - 1][x] !== arr[i][x]) {
							noDraw = false;
						}
					}
					if (noDraw) {
						return -1;
					}
				}
				let len = 0;
				while (i + len < arr.length) {
					let asc1, end1;
					let stop = false;
					for (
						x = 0, end1 = j, asc1 = end1 >= 0;
						asc1 ? x <= end1 : x >= end1;
						asc1 ? x++ : x--
					) {
						if (arr[i][x] !== arr[i + len][x]) {
							stop = true;
						}
					}
					if (stop) {
						break;
					}
					len++;
				}
				return len;
			},
			renderChart() {

				const pivotData = new PivotData(this.$props);

				const buildChartElement = (data) => {
					const chartHeight = (window.innerHeight / 100) * 60;

					setTimeout(() => {
						return new frappe.Chart(this.$refs.chartContainer, {
							data: data,
							type: opts.chartType,
							height: chartHeight,
							lineOptions: opts.lineOptions,
							colors: ['#7ad6ff', '#7a94ff', '#d7d0ff', '#ff7b92', '#ffad70', '#fff48d', '#7ef8b3', '#c1ff7a', '#d7b3ff', '#ff7bff', '#b1b1b1', '#8d8d8d']
						});
					}, 100)
				}

				if (Object.keys(pivotData.tree).length) {
					const rowKeys = pivotData.getRowKeys();
					const colKeys = pivotData.getColKeys();

					if (rowKeys.length === 0) {
						rowKeys.push([]);
					}
					if (colKeys.length === 0) {
						colKeys.push([]);
					}

					const headerRow = [];

					if (colKeys.length === 1 && colKeys[0].length === 0) {
						headerRow.push(this.aggregatorName);
					} else {
						colKeys.map((col) => {
							let filteredCols = col.filter(el => !!el);
							headerRow.push(filteredCols.join("-"));
						});
					}

					const rawData = rowKeys.map((r) => {
						const row = [];
						colKeys.map((c) => {
							const v = pivotData.getAggregator(r, c).value();
							row.push(v || "");
						});
						return row;
					});

					rawData.unshift(headerRow);

					const labels = rowKeys.flat();

					const datasets = rawData[0].map((name, index) => {
						const values = rawData.slice(1).map(row => row[index]);
						return {
							name: name,
							values: values
						};
					});

					const data = {
						labels: labels,
						datasets: datasets
					}

					buildChartElement(data)

				} else {

					buildChartElement({ labels: [], datasets: []})
				}
			},
		},
		render() {

			if (['table', 'heat-map-full', 'heat-map-col', 'heat-map-row'].includes(opts.mode)) {

				const pivotData = new PivotData(this.$props);
				const rowKeys = pivotData.getRowKeys();
				const colKeys = pivotData.getColKeys();
				const colAttrs = pivotData.props.cols;
				const rowAttrs = pivotData.props.rows;
				const grandTotalAggregator = pivotData.getAggregator([], []);

				// eslint-disable-next-line no-unused-vars
				let valueCellColors = () => { };
				// eslint-disable-next-line no-unused-vars
				let rowTotalColors = () => { };
				// eslint-disable-next-line no-unused-vars
				let colTotalColors = () => { };

				if (opts.mode && opts.mode !== 'table') {
					const colorScaleGenerator = this.tableColorScaleGenerator;
					const rowTotalValues = colKeys.map((x) =>
						pivotData.getAggregator([], x).value()
					);
					rowTotalColors = colorScaleGenerator(rowTotalValues);
					const colTotalValues = rowKeys.map((x) =>
						pivotData.getAggregator(x, []).value()
					);
					colTotalColors = colorScaleGenerator(colTotalValues);

					if (opts.mode === "heat-map-full") {
						const allValues = [];
						rowKeys.map((r) =>
							colKeys.map((c) =>
								allValues.push(pivotData.getAggregator(r, c).value())
							)
						);
						const colorScale = colorScaleGenerator(allValues);
						valueCellColors = (r, c, v) => colorScale(v);
					} else if (opts.mode === "heat-map-row") {
						const rowColorScales = {};
						rowKeys.map((r) => {
							const rowValues = colKeys.map((x) =>
								pivotData.getAggregator(r, x).value()
							);
							rowColorScales[r] = colorScaleGenerator(rowValues);
						});
						valueCellColors = (r, c, v) => rowColorScales[r](v);
					} else if (opts.mode === "heat-map-col") {
						const colColorScales = {};
						colKeys.map((c) => {
							const colValues = rowKeys.map((x) =>
								pivotData.getAggregator(x, c).value()
							);
							colColorScales[c] = colorScaleGenerator(colValues);
						});
						valueCellColors = (r, c, v) => colColorScales[c](v);
					}
				}

				const getClickHandler =
					this.tableOptions && this.tableOptions.clickCallback
						? (value, rowValues, colValues) => {
							const filters = {};
							for (const i of Object.keys(colAttrs || {})) {
								const attr = colAttrs[i];
								if (colValues[i] !== null) {
									filters[attr] = colValues[i];
								}
							}
							for (const i of Object.keys(rowAttrs || {})) {
								const attr = rowAttrs[i];
								if (rowValues[i] !== null) {
									filters[attr] = rowValues[i];
								}
							}
							return (e) =>
								this.tableOptions.clickCallback(e, value, filters, pivotData);
						}
						: null;

				return Vue.h(
					"table",
					{
						class: ["pvtTable"],
					},
					[
						Vue.h("thead", [
							colAttrs.map((c, j) => {
								return Vue.h(
									"tr",
									{
										key: `colAttrs${j}`,
									},
									[
										j === 0 && rowAttrs.length !== 0
											? Vue.h("th", {
												colSpan: rowAttrs.length,
												rowSpan: colAttrs.length,
											})
											: undefined,

										Vue.h(
											"th",
											{
												class: ["pvtAxisLabel"],
											},
											c
										),

										colKeys.map((colKey, i) => {
											const x = this.spanSize(colKeys, i, j);
											if (x === -1) {
												return null;
											}
											return Vue.h(
												"th",
												{
													class: ["pvtColLabel"],
													key: `colKey${i}`,
													colSpan: x,
													rowSpan:
														j === colAttrs.length - 1 && rowAttrs.length !== 0
															? 2
															: 1,
												},
												colKey[j]
											);
										}),
										j === 0 && this.rowTotal
											? Vue.h(
												"th",
												{
													class: ["pvtTotalLabel"],
													rowSpan:
														colAttrs.length + (rowAttrs.length === 0 ? 0 : 1),
												},
												"Totals"
											)
											: undefined,
									]
								);
							}),

							rowAttrs.length !== 0
								? Vue.h("tr", [
									rowAttrs.map((r, i) => {
										return Vue.h(
											"th",
											{
												class: ["pvtAxisLabel"],
												key: `rowAttr${i}`,
											},
											r
										);
									}),

									this.rowTotal
										? Vue.h(
											"th",
											{ class: ["pvtTotalLabel"] },
											colAttrs.length === 0 ? "Totals" : null
										)
										: colAttrs.length === 0
											? undefined
											: Vue.h("th", { class: ["pvtTotalLabel"] }, null),
								])
								: undefined,
						]),

						Vue.h("tbody", null, [
							rowKeys.map((rowKey, i) => {
								const totalAggregator = pivotData.getAggregator(rowKey, []);
								return Vue.h(
									"tr",
									{
										key: `rowKeyRow${i}`,
									},
									[
										rowKey.map((txt, j) => {
											const x = this.spanSize(rowKeys, i, j);
											if (x === -1) {
												return null;
											}
											return Vue.h(
												"th",
												{
													class: ["pvtRowLabel"],
													key: `rowKeyLabel${i}-${j}`,
													rowSpan: x,
													colSpan:
														j === rowAttrs.length - 1 && colAttrs.length !== 0
															? 2
															: 1,
												},
												txt
											);
										}),

										colKeys.map((colKey, j) => {
											const aggregator = pivotData.getAggregator(rowKey, colKey);
											return Vue.h(
												"td",
												Object.assign(
													{
														class: ["pvVal"],
														style: valueCellColors(
															rowKey,
															colKey,
															aggregator.value()
														),
														key: `pvtVal${i}-${j}`,
													},
													getClickHandler
														? {
															onClick: getClickHandler(
																aggregator.value(),
																rowKey,
																colKey
															),
														}
														: {}
												),
												aggregator.format(aggregator.value())
											);
										}),

										this.rowTotal
											? Vue.h(
												"td",
												Object.assign(
													{
														class: ["pvtTotal"],
														style: colTotalColors(totalAggregator.value()),
													},
													getClickHandler
														? {
															onClick: getClickHandler(
																totalAggregator.value(),
																rowKey,
																[null]
															),
														}
														: {}
												),
												totalAggregator.format(totalAggregator.value())
											)
											: undefined,
									]
								);
							}),

							Vue.h("tr", [
								this.colTotal
									? Vue.h(
										"th",
										{
											class: ["pvtTotalLabel"],
											colSpan:
												rowAttrs.length + (colAttrs.length === 0 ? 0 : 1),
										},
										"Totals"
									)
									: undefined,

								this.colTotal
									? colKeys.map((colKey, i) => {
										const totalAggregator = pivotData.getAggregator([], colKey);
										return Vue.h(
											"td",
											Object.assign(
												{
													class: ["pvtTotal"],
													style: rowTotalColors(totalAggregator.value()),
													key: `total${i}`,
												},
												getClickHandler
													? {
														onClick: getClickHandler(
															totalAggregator.value(),
															[null],
															colKey
														),
													}
													: {}
											),
											totalAggregator.format(totalAggregator.value())
										);
									})
									: undefined,

								this.colTotal && this.rowTotal
									? Vue.h(
										"td",
										Object.assign(
											{
												class: ["pvtGrandTotal"],
											},
											getClickHandler
												? {
													onClick: getClickHandler(
														grandTotalAggregator.value(),
														[null],
														[null]
													),
												}
												: {}
										),
										grandTotalAggregator.format(grandTotalAggregator.value())
									)
									: undefined,
							]),
						]),
					]
				)
			} else if (['bar-chart', 'line-chart', 'pie-chart', 'percentage-chart'].includes(opts.mode)) {

				return Vue.h('div', {
					ref: 'chartContainer',
					id: 'pivot_chart',
					innerHTML: this.renderChart()
				});
			}
		}
	};
	return TableRenderer;
}

const XLSXExportRenderer = {
	name: "xlsx-export-renderers",
	props: defaultProps.props,
	methods: {
		exportToXLSX(data) {
			const worksheet = XLSX.utils.aoa_to_sheet(data);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Pivot Data");

			const columnWidths = data[0].map((_, colIndex) => {
				const maxLength = data.reduce((max, row) => {
					const cellValue = row[colIndex] ? row[colIndex].toString() : "";
					return Math.max(max, cellValue.length);
				}, 10);
				return { wch: maxLength + 2 };
			});

			worksheet["!cols"] = columnWidths;

			XLSX.writeFile(workbook, !!cur_list.doctype ? `${cur_list.doctype.toLowerCase().replaceAll(' ', '_')}_pivot_export.xlsx` : "pivot_data_export.xlsx", {cellStyles: true});
		},
	},
	render() {
		const pivotData = new PivotData(this.$props);
		const rowKeys = pivotData.getRowKeys();
		const colKeys = pivotData.getColKeys();

		if (rowKeys.length === 0) {
			rowKeys.push([]);
		}
		if (colKeys.length === 0) {
			colKeys.push([]);
		}

		const rows = Array.from(pivotData.props.rows)
		const cols = Array.from(pivotData.props.cols)

		const format_data = []

		cols.forEach(col => format_data.push([col]))
		rows.forEach(row => format_data.forEach(col => col.unshift('')))

		for (let i = 0; i < colKeys.length; i++) {
			for (let j = 0; j < cols.length; j++) {
				format_data[j].push(colKeys[i][j])
			}
		}

		const format_rows = rows

		for (let i = 0; i < colKeys.length + 1; i++) {
			format_rows.push('')
		}

		format_data.push(format_rows)

		const datas = rowKeys.map((r) => {
			const row = r.map((x) => x);
			if (cols.length) row.push('')

			colKeys.map((c) => {
				const v = pivotData.getAggregator(r, c).value();
				row.push(v || "");
			});
			return row;
		});

		datas.forEach(data => format_data.push(data))

		console.log(format_data);

		return Vue.h("div", {
			class: "d-flex justify-content-center align-items-center",
			style: {
				width: "100%",
				height: "60vh",
			},
		}, [
			Vue.h("button", {
				class: "btn btn-default btn-sm ellipsis mb-3",
				onClick: () => this.exportToXLSX(format_data),
			}, __("Export to XLSX"))
		]);
	},
};

const renderers = {
	"Table": makeRenderer({
		mode: "table",
		name: "vue-table"
	}),
	"Table Heatmap": makeRenderer({
		mode: "heat-map-full",
		name: "vue-table-heatmap",
	}),
	"Table Col Heatmap": makeRenderer({
		mode: "heat-map-col",
		name: "vue-table-col-heatmap",
	}),
	"Table Row Heatmap": makeRenderer({
		mode: "heat-map-row",
		name: "vue-table-col-heatmap",
	}),
	"Bar Chart": makeRenderer({
		name: "bar-chart",
		mode: 'bar-chart',
		chartType: "bar",
		lineOptions: {},
	}),
	"Line Chart Straight": makeRenderer({
		name: "line-chart",
		mode: 'line-chart',
		chartType: "line",
		lineOptions: {},
	}),
	"Line Chart Curved": makeRenderer({
		name: "line-chart",
		mode: 'line-chart',
		chartType: "line",
		lineOptions: {
			spline: 1
		},
	}),
	"Pie Chart": makeRenderer({
		name: "pie-chart",
		mode: 'pie-chart',
		chartType: "pie",
		lineOptions: {},
	}),
	"Percentage Chart": makeRenderer({
		name: "percentage-chart",
		mode: 'percentage-chart',
		chartType: "percentage",
		lineOptions: {},
	}),
	"Export": XLSXExportRenderer,
};

const translated_renderers = {};

Object.keys(renderers).forEach((key) => {
	translated_renderers[__(key)] = renderers[key];
});

export default translated_renderers;