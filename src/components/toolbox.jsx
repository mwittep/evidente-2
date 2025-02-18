import React, { Component } from "react";
import NodeInformation from "./nodeinfo";
import Legend from "./legend";
import Tools from "./tools";
import { round, last, clamp, toPairs } from "lodash";
import * as d3 from "d3";
/**
 * Tools sidebar component
 * Calls Legend, NodeInformation and Tools
 *
 */
class Toolbox extends Component {
  state = {};

  /**
   * Creates the legend within the given container.
   * It is updated everytime the user changes the scale
   *
   * @param {HTMLElement} container, where the legend should be included
   * @param {Number} cellWidth, defines the width of the legend
   * @param {Object} rowOfData, defines the data
   * @param {Boolean} isStatic, defines if the output created is done for the tool or for the exporting object
   */
  addLegend = (container, cellWidth, { name, colorScale, extent, type }, isStatic = false) => {
    let svg = container.append("g").attr("id", `g-legend-${name.replace(/ /g, "-")}`);
    let div = d3.select("#tooltip");
    let elementHeight = 15;

    const addTexts = (element, posX, posY, anchor, attributes, text) => {
      return element
        .append("g")
        .append("text")
        .style("text-anchor", anchor)
        .attr({
          x: posX,
          y: posY,
        })
        .attr(attributes)
        .classed("noselect", true)
        .text(text);
    };

    const addMouseOver = (element, text = undefined) => {
      element
        .on("mouseover", (d) => {
          div.transition().duration(200).style("opacity", 0.9).style("display", "flex");
          div
            .html(text ? text : d)
            .style("left", d3.event.pageX + "px")
            .style("top", d3.event.pageY - 28 + "px");
        })
        .on("mouseout", function (d) {
          div.transition().duration(500).style("opacity", 0);
        });
    };

    let attrShadow = { stroke: "white", "stroke-width": "5px", opacity: 0.75 };
    let attrsFronttext = { fill: "black" };
    let marginText = 2;
    let yPosition = 15 * 0.75;
    switch (type.toLowerCase()) {
      case "numerical":
        var defs = svg.append("defs");

        //Append a linearGradient element to the defs and give it a unique id
        var linearGradient = defs
          .append("linearGradient")
          .attr("id", `linear-gradient-${name.replace(/ /g, "-")}`);
        //Horizontal gradient
        linearGradient.attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
        //Set the color for the start (0%)
        linearGradient
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", colorScale(extent[0])); //light blue

        //Set the color for the end (100%)
        linearGradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colorScale(extent[1])); //dark blue

        let group = svg.append("g");
        group
          .append("rect")
          .attr("width", cellWidth)
          .attr("height", elementHeight)
          .style("fill", `url(#linear-gradient-${name.replace(/ /g, "-")})`);

        let minExtent = parseFloat(extent[0].toFixed(2));
        addTexts(group, marginText, yPosition, "start", attrShadow, minExtent);
        let textLeft = addTexts(group, marginText, yPosition, "start", attrsFronttext, minExtent);

        let maxExtent = parseFloat(extent[1].toFixed(2));
        let posRight = cellWidth - marginText;
        addTexts(group, posRight, yPosition, "end", attrShadow, maxExtent);
        let textRight = addTexts(group, posRight, yPosition, "end", attrsFronttext, maxExtent);

        if (!isStatic) {
          addMouseOver(textLeft, minExtent);
          addMouseOver(textRight, maxExtent);
        }

        break;

      case "snp":
        let cladeSpecificity = ["+", "—"];
        let [posSpecificity, negSpecificity] = cladeSpecificity;

        const createAxis = (extent, maxRange, orient) => {
          let tempScale = d3.scale.ordinal().domain(extent).rangeBands([0, maxRange]);
          let tempAxis = d3.svg
            .axis()
            .scale(tempScale)
            .tickFormat((d) => d)
            .orient(orient);
          return [tempScale, tempAxis];
        };

        let [xScale, xAxis] = createAxis(extent, cellWidth - 10, "top");
        let [yScale, yAxis] = createAxis(cladeSpecificity, 30, "left");

        const renderAxis = (classType, axis, transform = "") => {
          return svg
            .append("g")
            .attr("class", `SNP-legend-${classType}`)
            .attr("transform", transform)
            .call(axis)
            .call((g) => g.select(".domain").remove())
            .selectAll("text")
            .style("font-size", `${Math.min(cellWidth, 10)}px`)
            .style("text-anchor", "start");
        };

        let maxWidth = 0;

        renderAxis("y-axis", yAxis).each(function () {
          maxWidth = Math.max(maxWidth, this.getComputedTextLength());
        });
        renderAxis("x-axis", xAxis, `translate(-5, 5)`);

        let margin = maxWidth + 5;
        let legendCubeWidth = (cellWidth - margin) / extent.length;
        let legendCubeHeight = elementHeight;

        let groupAllele = svg.selectAll("rect").data(extent).enter();

        const addRectangle = (posY, fill) => {
          groupAllele
            .append("svg:rect")
            .attr("width", legendCubeWidth)
            .attr("height", legendCubeHeight)
            .attr("y", posY)
            .attr("x", (d) => xScale(d))
            .attr("fill", fill);
        };

        addRectangle(yScale(posSpecificity), (d) => colorScale(d)); // adds Positive SNPs
        addRectangle(yScale(negSpecificity), (d) => colorScale(d)); // adds Negative SNPs
        addRectangle(yScale(negSpecificity), "url(#diagonalHatch)"); // adds Pattern over Negative SNPs

        svg.attr("transform", `translate(${margin}, 12)`);
        break;

      default:
        let textWidth = [];
        let cubeWidth = cellWidth / extent.length;
        let groupCategory = svg.selectAll("g").data(extent).enter().append("g");

        let shadow = addTexts(groupCategory, 0, yPosition, "middle", attrShadow, (d) => d).each(
          function () {
            let thisWidth = Math.max(cubeWidth, this.getComputedTextLength() + 10); // Text width + margin
            textWidth.push(thisWidth);
          }
        );

        let text = addTexts(groupCategory, 0, yPosition, "middle", attrsFronttext, (d) => d);
        if (!isStatic) {
          addMouseOver(text);
        }

        const cumulativeSum = ((sum) => (value) => (sum += value))(0);
        const ceiledCumulativeSum = (([x, y], top) => (value) =>
          x + value < top ? [(x += value), y] : [(x = 0), (y += 1)])([0, 0], cellWidth);

        let textWidthSum = textWidth.map(cumulativeSum);
        let positions = [0, ...textWidthSum];
        let positionX, positionY;
        if (isStatic) {
          let temp = textWidth.map(ceiledCumulativeSum);
          positionX = [0, ...temp.map((d) => d[0])];
          positionY = [0, ...temp.map((d) => d[1] * elementHeight)];
          d3.select(`#testing-output-${name.replace(/[^a-zA-Z0-9_-]/g, "_")}`).attr({
            height: Math.max(positionY.slice(-1)[0] + elementHeight, elementHeight),
          });
        }
        shadow.attr(
          isStatic
            ? {
                x: (d, i) => positionX[i] + textWidth[i] * 0.5,
                y: (d, i) => positionY[i] + 12,
              }
            : {
                x: (d, i) => positions[i] + textWidth[i] * 0.5,
              }
        );
        text.attr(
          isStatic
            ? {
                x: (d, i) => positionX[i] + textWidth[i] * 0.5,
                y: (d, i) => positionY[i] + 12,
              }
            : {
                x: (d, i) => positions[i] + textWidth[i] * 0.5,
              }
        );

        groupCategory
          .insert("rect", ":first-child")
          .attr({
            width: (d, i) => Math.max(textWidth[i], cubeWidth + 10),
            height: elementHeight,
          })
          .attr(
            isStatic
              ? { x: (d, i) => positionX[i], y: (d, i) => positionY[i], stroke: "black" }
              : {
                  x: (d, i) => positions[i],
                }
          )
          .style("fill", (value) => colorScale(value));

        if (round(last(positions)) > cellWidth && !isStatic) {
          let drag = d3.behavior.drag().on("drag", dragmove);
          function dragmove(d) {
            let actualTransform = d3.transform(d3.select(this).attr("transform")).translate[0];
            let x = clamp(d3.event.dx + actualTransform, cellWidth - last(positions), 0);
            d3.select(this).attr("transform", `translate( ${x}  , 0)`);
          }
          svg.style("cursor", "grab").call(drag);
        }

        break;
    }
  };

  /**
   * Transforms the metadata from Object of key->values to array of objects
   *
   * @param {Object} metadata Object containng the metadata names as keys, content as value.
   */
  metadataToRows = (metadata) =>
    toPairs(metadata)
      .filter((d) => d[1].type.toLowerCase() !== "type")
      .map((d) => ({
        name: d[0],
        colorScale: d[1].colorScale,
        extent: d[1].extent,
        type: d[1].type,
      }));

  render() {
    let modifiedMetadata = this.metadataToRows(this.props.availableMDs);
    return (
      <div id='toolbox' className='rchild'>
        <Legend
          addLegend={this.addLegend}
          orderChanged={this.props.orderChanged}
          visSNPs={this.props.visSNPs}
          visMd={this.props.visMd}
          availableMDs={modifiedMetadata}
          onChange={this.props.onColorChange}
          onChangeOrder={this.props.onChangeOrder}
        />
        <NodeInformation
          SNPTable={this.props.SNPTable}
          onSNPaddition={this.props.onSNPaddition}
          onMultipleSNPaddition={this.props.onMultipleSNPaddition}
        >
          Node Information
        </NodeInformation>
        <Tools
          handleLoadingToggle={this.props.handleLoadingToggle}
          availableMDs={this.props.availableMDs}
          availableSNPs={this.props.availableSNPs}
          onFileUpload={this.props.onFileUpload}
          onMDChange={this.props.onMDChange}
          onSNPChange={this.props.onSNPChange}
          visMd={this.props.visMd}
          visSNPs={this.props.visSNPs}
          orderChanged={this.props.orderChanged}
          onColorChange={this.props.onColorChange}
          onOpenFilter={this.props.onOpenFilter}
          createdFilters={this.props.createdFilters}
          remainingNodes={this.props.remainingNodes}
          nameOfFilters={this.props.nameOfFilters}
          onDeleteFilter={this.props.onDeleteFilter}
          onDeleteAllFilters={this.props.onDeleteAllFilters}
          onApplyAllFilters={this.props.onApplyAllFilters}
          addLegend={this.addLegend}
          metadataToRows={this.metadataToRows}
        >
          Tools
        </Tools>
      </div>
    );
  }
}

export default Toolbox;
