// ==UserScript==

// @name         Line Rider Canvas Mod
// @author       IcedDog
// @description  Regenerate the canvas and add some features.
// @version      1.0

// @namespace    http://tampermonkey.net/
// @match        https://www.linerider.com/*
// @match        https://*.official-linerider.com/*
// @match        http://localhost:8000/*
// @match        https://square-rider.surge.sh/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/mathjs/9.2.0/math.js
// @grant        none
// @downloadURL  https://github.com/Malizma333/linerider-userscript-mods/raw/master/mods/line-rider-graph-mod.user.js
// @updateURL    https://github.com/Malizma333/linerider-userscript-mods/raw/master/mods/line-rider-graph-mod.user.js
// ==/UserScript==

const getCanvas = () => {
	return document.getElementsByTagName("canvas")[0];
};

const defaultVertexShader = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 vTexCoord;
uniform mat4 u_matrix;

void main() {
  gl_Position = u_matrix * vec4(a_position, 0, 1);
  vTexCoord = a_texCoord;
}`;

const defaultFragmentShader = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uSampler;

void main() {
	  gl_FragColor = texture2D(uSampler, vTexCoord);
}`;

let shaderProgram = (gl, vertexShader, fragmentShader) => {
	return createProgram(
		gl,
		createShader(gl, gl.VERTEX_SHADER, vertexShader),
		createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
	);
};

class CanvasMod {
	constructor(store, initState) {
		this.store = store;
		this.state = initState;

		this.changed = false;
		this.canvas = null;
		this.originalCanvas = null;

		store.subscribeImmediate(() => {
			this.onUpdate();
		});

		this.originalCanvas = getCanvas();
	}

	setValue(key, value) {
		this.state[key] = value;
	}

	onUpdate(nextState = this.state) {
		let shouldUpdate = false;

		if (this.state !== nextState) {
			this.state = nextState;
			shouldUpdate = true;
		}

		if (shouldUpdate) {
			applyCanvas(this);
		}

		if (this.state.canvasActive) updateCanvas(this);
	}
}

function main() {
	const { React, store } = window;

	const create = React.createElement;

	class CanvasModComponent extends React.Component {
		constructor(props) {
			super(props);

			this.state = {
				active: false,
				func: "",
				canvasActive: false,
				shaderActive: false,
				shader: "",
				uniforms: ""
			};

			this.canvasMod = new CanvasMod(store, this.state);
		}

		componentWillUpdate(nextProps, nextState) {
			this.canvasMod.onUpdate(nextState);
		}

		renderCheckbox(key, title, props) {
			props = {
				...props,
				checked: this.state[key],
				onChange: (create) => this.setState({ [key]: create.target.checked }),
			};
			return create(
				"div",
				null,
				title,
				create("input", { type: "checkbox", ...props })
			);
		}

		renderSlider(key, title, props) {
			props = {
				...props,
				value: this.state[key],
				onChange: (create) =>
					this.setState({ [key]: parseFloat(create.target.value) }),
			};

			return create(
				"div",
				null,
				title,
				create("input", { style: { width: "4em" }, type: "number", ...props }),
				create("input", {
					type: "range",
					...props,
					onFocus: (create) => create.target.blur(),
				})
			);
		}

		onActivate() {
			if (this.state.active) {
				this.setState({ active: false });
			} else {
				this.setState({ active: true });
			}
		}

		render() {
			return create(
				"div",
				null,
				this.state.active &&
					create(
						"div",
						null,
						create(
							"div",
							null,
							"Shader:",
							create("textArea", {
								style: { width: "88%" },
								type: "text",
								value: this.state.shader,
								onChange: (create) =>
									this.setState({ shader: create.target.value }),
							}),
							"Uniforms:",
							create("textArea", {
								style: { width: "88%" },
								type: "text",
								value: this.state.uniforms,
								onChange: (create) =>
									this.setState({ uniforms: create.target.value }),
							}),
							this.renderCheckbox("shaderActive", "Shader Active"),
							this.renderCheckbox("canvasActive", "Canvas Active")
						)
					),
				create(
					"button",
					{
						style: {
							backgroundColor: this.state.active ? "lightblue" : null,
						},
						onClick: this.onActivate.bind(this),
					},
					"Canvas Mod"
				)
			);
		}
	}

	window.registerCustomSetting(CanvasModComponent);
}

if (window.registerCustomSetting) {
	main();
} else {
	const prevCb = window.onCustomToolsApiReady;
	window.onCustomToolsApiReady = () => {
		if (prevCb) prevCb();
		main();
	};
}

function updateCanvas(canvasMod) {
	try {
		if (
			canvasMod.originalCanvas !== null &&
			canvasMod.originalCanvas !== undefined
		)
			if (canvasMod.canvas !== null && canvasMod.canvas !== undefined) {
				const gl = canvasMod.canvas.getContext("webgl");
				const shader = shaderProgram(
					gl,
					defaultVertexShader,
					canvasMod.state.shaderActive
						? canvasMod.state.shader
						: defaultFragmentShader
				);
				const texture = loadTexture(gl, canvasMod.originalCanvas);
				renderTexture(gl, shader, texture, canvasMod.state.uniforms=== "" ? {} : JSON.parse(canvasMod.state.uniforms));
			}
	} catch (e) {
		console.log(e);
		return;
	}
	return;
}

function applyCanvas(canvasMod) {
	try {
		if (!canvasMod.state.canvasActive) {
			if (canvasMod.canvas !== null && canvasMod.canvas !== undefined) {
				canvasMod.canvas.remove();
				canvasMod.canvas = null;
			}
			canvasMod.originalCanvas.style = "width: 100%; height: 100%;";
			return;
		}
		if (
			canvasMod.originalCanvas !== null &&
			canvasMod.originalCanvas !== undefined
		) {
			if (canvasMod.canvas !== null && canvasMod.canvas !== undefined) {
				updateCanvas(canvasMod.canvas, canvasMod.originalCanvas);
			} else {
				let newCanvas = document.createElement("canvas");
				newCanvas.width = canvasMod.originalCanvas.width;
				newCanvas.height = canvasMod.originalCanvas.height;
				newCanvas.style = "width: 100%; height: 100%;";

				canvasMod.canvas = newCanvas;

				canvasMod.originalCanvas.parentNode.insertBefore(
					canvasMod.canvas,
					canvasMod.originalCanvas.nextSibling
				);

				canvasMod.originalCanvas.style =
					"width: 100%; height: 100%; display: none;";
				applyCanvas(canvasMod);
			}
		} else {
			canvasMod.originalCanvas = getCanvas();
		}
	} catch (e) {
		console.log(e);
		return;
	}
}

function createShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (success) {
		return shader;
	}
	else {
		console.log(gl.getShaderInfoLog(shader));
	}
	gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
	const program = gl.createProgram();

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);

	gl.linkProgram(program);

	const success = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (success) {
		return program;
	}

	console.log(gl.getProgramInfoLog(program));
	gl.deleteProgram(program);
}

function loadTexture(gl, input) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);

	return texture;
}

function renderTexture(gl, program, texture, uniforms = {}) {
	gl.useProgram(program);

	const positionLocation = gl.getAttribLocation(program, "a_position");
	const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	const matrixLocation = gl.getUniformLocation(program, "u_matrix");
	const samplerLocation = gl.getUniformLocation(program, "uSampler");
	const resolutionLocation = gl.getUniformLocation(program, "uResolution");
	const timeLocation = gl.getUniformLocation(program, "time");

	gl.uniformMatrix4fv(
		matrixLocation,
		false,
		[1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
	);

	let resolution = [gl.canvas.width, gl.canvas.height];
	gl.uniform2fv(resolutionLocation, resolution);

	let time = window.store.getState().player.index / window.store.getState().player.settings.fps;
	gl.uniform1f(timeLocation, time);

	gl.uniform1i(samplerLocation, 0);

	for (let uniformName in uniforms) {
		let uniformLocation = gl.getUniformLocation(program, uniformName);
		let uniformValue = uniforms[uniformName];
		if (typeof uniformValue === "number") {
			gl.uniform1f(uniformLocation, uniformValue);
		} else if (uniformValue instanceof Array) {
			// change it into Float32Array
			uniformValue = new Float32Array(uniformValue);
			if (uniformValue.length === 2) {
				gl.uniform2fv(uniformLocation, uniformValue);
			}
			else if (uniformValue.length === 3) {
				gl.uniform3fv(uniformLocation, uniformValue);
			}
			else if (uniformValue.length === 4) {
				gl.uniform4fv(uniformLocation, uniformValue);
			}
		} else {
			console.error("Unsupported uniform type:", uniformValue);
		}
	}

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	setRectangle(gl, -1, -1, 2, 2);

	const texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([
			0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0,
		]),
		gl.STATIC_DRAW
	);

	gl.enableVertexAttribArray(positionLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

	gl.enableVertexAttribArray(texCoordLocation);
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);

	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function setRectangle(gl, x, y, width, height) {
	const x1 = x;
	const x2 = x + width;
	const y1 = y;
	const y2 = y + height;

	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
		gl.STATIC_DRAW
	);
}
