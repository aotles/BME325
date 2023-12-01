window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('webglCanvas');
    //modify canvas size
    canvas.width = 2000;
    canvas.height = 2000;
    const gl = canvas.getContext('webgl2');
    gl.getExtension('OES_texture_float');
    if (!gl.getExtension('EXT_color_buffer_float'))
        throw new Error('Rendering to floating point textures is not supported on this platform');

    if (!gl) {
        alert('WebGL2 is not supported in this browser.');
        return;
    }

    const sigmaSlider = document.getElementById('sigmaSlider');
    const alphaSlider = document.getElementById('alphaSlider');

    let eventList = [];
    //fetch pet_det_events.csv
    fetch('pet_det_events.csv')
        .then(response => response.text())
        .then(text => {
            //parse csv into float data
            let data = text.split('\n').map(row => row.split(','));
            //skip header
            data = data.slice(1);
            data = data.map(row => row.map(x => parseFloat(x)));
            //append to eventList
            eventList = eventList.concat(data);
            //console.log(data);


            // Render to Float Texture instead of Canvas
            const texture = createFrameBuffer(gl);

            let sigmaValue = 0.3;
            let alphaFactor = 2.0;

            // Write your WebGL code here
            renderLines(gl, eventList, sigmaValue, alphaFactor);
            renderTexture(gl, texture, 2000, 2000);


            sigmaSlider.addEventListener('input', () => {
                sigmaValue = parseFloat(sigmaSlider.value);
                console.log(sigmaValue);
                const texture = createFrameBuffer(gl);
                renderLines(gl, eventList, sigmaValue, alphaFactor);
                renderTexture(gl, texture, 2000, 2000);
            });

            alphaSlider.addEventListener('input', () => {
                alphaFactor = parseFloat(alphaSlider.value);
                console.log(alphaFactor);
                const texture = createFrameBuffer(gl);
                renderLines(gl, eventList, sigmaValue, alphaFactor);
                renderTexture(gl, texture, 2000, 2000);
            });


        });
});


function createFrameBuffer(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 2000, 2000, 0, gl.RGBA, gl.FLOAT, null);
    // Create and bind the framebuffer
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // Attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, 2000, 2000);
    return texture;
}

function renderTexture(gl, texture, width, height) {

    // Vertex shader
    const vertexShaderSource = `
                attribute vec2 a_position;
                varying vec2 v_texcoord;
                void main() {
                    gl_Position = vec4(a_position, 0, 1);
                    v_texcoord = (a_position + 1.0) / 2.0;
                }
            `;

    // Fragment shader
    const fragmentShaderSource = `
                precision highp float;
                uniform sampler2D u_texture;
                varying vec2 v_texcoord;
                void main() {
                    gl_FragColor = texture2D(u_texture, v_texcoord);
                }
            `;

    // Compile and link shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1, -1,
        1, -1,
        -1, 1,
        1, 1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // switch framebuffer to default
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

}

function determineAnnihilationPoint(det1x, det1y, det2x, det2y, deltaToF) {
    let detLine = [det2x - det1x, det2y - det1y];
    let midpoint = [(det1x + det2x) / 2.0, (det1y + det2y) / 2.0];
    let pointX =  deltaToF / 2.0 * detLine[0]/2. + midpoint[0];
    let pointY =  deltaToF / 2.0 * detLine[1]/2. + midpoint[1];
    let point = [pointX, pointY];
    return point;
}

function renderDetector(gl, x, y, radius){
    // Vertex shader
    const vertexShaderSource = `
                attribute vec3 a_position;
                void main() {
                    gl_Position = vec4(a_position, 1);
                }
            `;
    // Fragment shader
    const fragmentShaderSource = `
                precision highp float;
                uniform vec3 color;
                void main() {
                    gl_FragColor = vec4(color, 1.0);
                }
            `;
    // Compile and link shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    // Create a buffer for the square's positions
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Specify the position attribute
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    
    const positions = [
        x-radius, y-radius, 0.0,
        x + radius, y-radius, 0.0,
        x-radius, y+radius, 0.0,
        x + radius, y+radius, 0.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.getUniformLocation(program, 'color');
    const color = [1.0, 0.0, 0.0];
    const colorLocation = gl.getUniformLocation(program, 'color');
    gl.uniform3fv(colorLocation, color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

}
    

function renderLines(gl, eventList, sigmaValue, alphaFactor) {
    // Vertex shader
    const vertexShaderSource = `
                attribute vec3 a_position;
                void main() {
                    gl_Position = vec4(a_position, 1);
                }
            `;

    // Fragment shader
    const fragmentShaderSource = `
                precision highp float;
                uniform vec2  mu; 
                uniform float sigma;
                uniform float alphaFactor;
                void main() {
                    //normalize gl_FragCoord
                    vec2 norm_FragCoord = (gl_FragCoord.xy - vec2(1000., 1000.))/ vec2(1000.0, 1000.0);
                    vec2 x = norm_FragCoord - mu;
                    float a = 1.0 / (5000. * sigma * sigma);
                    a *= exp(-1.0 * (x.x * x.x + x.y * x.y) / (2.0 * sigma * sigma));
                    a *= alphaFactor;
                    gl_FragColor = vec4(1.0, 1.0, 1.0, a);
                }
            `;

    // Compile and link shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Get the locations of the uniforms
    const muLocation = gl.getUniformLocation(program, 'mu');
    const sigmaLocation = gl.getUniformLocation(program, 'sigma');
    const alphaFactorLocation = gl.getUniformLocation(program, 'alphaFactor');

    // Create a buffer for the square's positions
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Specify the position attribute
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    // Draw the square
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const thickness = 0.001;
    const timeRes = 1.0;

    for (let i = 0; i < eventList.length; ++i) {
        let [det1x, det1y, det2x, det2y, deltaToF] = eventList[i];
        let dx = det2x - det1x;
        let dy = det2y - det1y;
        let z = 1.0 - i / (eventList.length + 0.0);
        //get perpendicular vector
        let perp = [dy, -dx];
        let positions = [
            det1x + perp[0] * thickness, det1y + perp[1] * thickness, z,
            det1x - perp[0] * thickness, det1y - perp[1] * thickness, z,
            det2x + perp[0] * thickness, det2y + perp[1] * thickness, z,
            det2x - perp[0] * thickness, det2y - perp[1] * thickness, z
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);


        // convert deltaToF to mu
        let muValue = determineAnnihilationPoint(det1x, det1y, det2x, det2y, deltaToF);

        gl.uniform2fv(muLocation, muValue);
        gl.uniform1f(sigmaLocation, sigmaValue);
        gl.uniform1f(alphaFactorLocation, Math.pow(10,alphaFactor))

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    }
}
