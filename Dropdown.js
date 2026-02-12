import { h } from "vue";
export default {
	props: ["value", "values", "labels", "changeValue"],
	emits: ["input"],
	render() {
		return h(
			"select",
			{
				class: "pvtDropdown",
				onChange: (e) => this.$emit("input", e.target.value),
			},
			this.values.map((val) => {
				const label = this.labels && this.labels[val] ? this.labels[val] : val;
				return h(
					"option",
					{
						value: val,
						key: `dropdown-${val}`,
						selected: val === this.value,
					},
					label
				);
			})
		);
	},
};