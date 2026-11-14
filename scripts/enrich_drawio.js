const fs = require('fs');

let content = fs.readFileSync('docs/diagrams/MotoTrack_Flowcharts.drawio', 'utf8');

// Build Rider page in draw.io format
const riderPageXml = `
  <diagram name="Rider Delivery" id="MotoTrackRiderDiagram">
    <mxGraphModel grid="0" page="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" pageScale="1" pageWidth="1100" pageHeight="850" background="#FFFFFF" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="rd-badge1" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=12;fontStyle=1;" value="RD1" vertex="1">
          <mxGeometry x="80" y="50" width="36" height="36" as="geometry" />
        </mxCell>
        <mxCell id="rd-badge2" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=12;fontStyle=1;" value="RD2" vertex="1">
          <mxGeometry x="130" y="50" width="36" height="36" as="geometry" />
        </mxCell>
        <mxCell id="rd-badge3" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=12;fontStyle=1;" value="RD3" vertex="1">
          <mxGeometry x="180" y="50" width="36" height="36" as="geometry" />
        </mxCell>
        <mxCell id="rd-dash" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=12;" value="Rider Operations Dashboard" vertex="1">
          <mxGeometry x="50" y="120" width="200" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-manifest" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=12;" value="Assigned Deliveries Manifest" vertex="1">
          <mxGeometry x="45" y="195" width="210" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-action" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=12;" value="Rider Delivery Action" vertex="1">
          <mxGeometry x="80" y="270" width="140" height="40" as="geometry" />
        </mxCell>
        
        <!-- RD1 Run -->
        <mxCell id="rd-act1" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="[RD1] Start Run &amp; Broadcast GPS" vertex="1">
          <mxGeometry x="50" y="360" width="180" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-maps" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Turn-by-Turn Maps Navigation" vertex="1">
          <mxGeometry x="45" y="440" width="190" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-gps" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Broadcast Live GPS to DB (26)" vertex="1">
          <mxGeometry x="45" y="520" width="190" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-db26" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;fontStyle=1;" value="26" vertex="1">
          <mxGeometry x="125" y="600" width="30" height="30" as="geometry" />
        </mxCell>

        <!-- RD2 Proof of Delivery -->
        <mxCell id="rd-act2" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="[RD2] Scan Customer QR Token" vertex="1">
          <mxGeometry x="320" y="360" width="180" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-dec" parent="1" style="strokeWidth=1;html=1;shape=mxgraph.flowchart.decision;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;" value="QR Token Valid?" vertex="1">
          <mxGeometry x="340" y="440" width="140" height="60" as="geometry" />
        </mxCell>
        <mxCell id="rd-pod" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Capture POD Photo &amp; Signature" vertex="1">
          <mxGeometry x="325" y="535" width="170" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-db27" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;fontStyle=1;" value="27" vertex="1">
          <mxGeometry x="395" y="615" width="30" height="30" as="geometry" />
        </mxCell>

        <!-- RD3 Earnings -->
        <mxCell id="rd-act3" parent="1" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="[RD3] View Earnings Ledger" vertex="1">
          <mxGeometry x="580" y="360" width="180" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-ledger" parent="1" style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=none;strokeColor=#000000;fontSize=11;" value="Shipping Fee Commission Summary" vertex="1">
          <mxGeometry x="565" y="440" width="210" height="45" as="geometry" />
        </mxCell>
        <mxCell id="rd-db28" parent="1" style="strokeWidth=1;html=1;shape=ellipse;whiteSpace=wrap;fillColor=none;strokeColor=#000000;fontSize=11;fontStyle=1;" value="28" vertex="1">
          <mxGeometry x="655" y="525" width="30" height="30" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
`;

// Insert the new Rider page before </mxfile>
if (!content.includes('name="Rider Delivery"')) {
  content = content.replace('</mxfile>', `${riderPageXml}\n</mxfile>`);
  // Update pages count
  content = content.replace(/pages="\d+"/, 'pages="7"');
  fs.writeFileSync('docs/diagrams/MotoTrack_Flowcharts.drawio', content, 'utf8');
  console.log('Appended Rider Delivery page to docs/diagrams/MotoTrack_Flowcharts.drawio');
}
