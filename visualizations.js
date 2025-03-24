class CarVisualization {
  constructor() {
    this.data = [];
    this.filters = {
      manufacturer: 'all',
      origin: 'all',
      cylinders: 'all'
    };
    this.selectedPoints = new Set();
    this.init();
  }

  async init() {
    await this.loadData();
    this.initControls();
    this.createVisualizations();
  }

  async loadData() {
    try {
      const raw = await d3.csv("https://raw.githubusercontent.com/hemanthpranav/IV-MAIN/main/a1-cars.csv");
      this.data = raw.map(d => ({
        Car: d.Car,
        Manufacturer: d.Manufacturer,
        MPG: +d.MPG || null,
        Horsepower: +d.Horsepower || null,
        Weight: +d.Weight || null,
        Acceleration: +d.Acceleration || null,
        Cylinders: +d.Cylinders || null,
        Origin: d.Origin,
        Displacement: +d.Displacement || null
      })).filter(d => d.MPG && d.Horsepower && d.Weight && d.Acceleration);
      
      this.updateVisualizations();
    } catch (error) {
      console.error("Data loading failed:", error);
      d3.select("#bar-chart").html('<p class="error">Error loading data. Please try again.</p>');
    }
  }

  initControls() {
    // Manufacturer filter
    const manufacturers = [...new Set(this.data.map(d => d.Manufacturer))].sort();
    d3.select("#manufacturer-filter")
      .selectAll("option")
      .data(["all", ...manufacturers])
      .join("option")
      .attr("value", d => d)
      .text(d => d === "all" ? "All Manufacturers" : d);

    // Origin filter
    const origins = [...new Set(this.data.map(d => d.Origin))].sort();
    d3.select("#origin-filter")
      .selectAll("option")
      .data(["all", ...origins])
      .join("option")
      .attr("value", d => d)
      .text(d => d === "all" ? "All Origins" : d);

    // Cylinders filter
    const cylinders = [...new Set(this.data.map(d => d.Cylinders))].sort((a,b) => a - b);
    d3.select("#cylinders-filter")
      .selectAll("option")
      .data(["all", ...cylinders])
      .join("option")
      .attr("value", d => d)
      .text(d => d === "all" ? "All Cylinders" : `${d} cylinders`);

    // Event listeners
    d3.selectAll(".filter").on("change", () => this.applyFilters());
    d3.select("#reset-btn").on("click", () => this.resetFilters());
  }

  applyFilters() {
    this.filters = {
      manufacturer: d3.select("#manufacturer-filter").property("value"),
      origin: d3.select("#origin-filter").property("value"),
      cylinders: d3.select("#cylinders-filter").property("value")
    };
    this.updateVisualizations();
  }

  resetFilters() {
    d3.selectAll(".filter").property("value", "all");
    this.filters = { manufacturer: 'all', origin: 'all', cylinders: 'all' };
    this.selectedPoints.clear();
    this.updateVisualizations();
  }

  updateVisualizations() {
    let filtered = this.data.filter(d => 
      (this.filters.manufacturer === "all" || d.Manufacturer === this.filters.manufacturer) &&
      (this.filters.origin === "all" || d.Origin === this.filters.origin) &&
      (this.filters.cylinders === "all" || d.Cylinders == this.filters.cylinders)
    );

    // Apply point selection if any
    if (this.selectedPoints.size > 0) {
      filtered = filtered.filter(d => this.selectedPoints.has(d.Car));
    }

    this.renderBarChart(filtered);
    this.renderScatterPlot(filtered);
    this.renderWeightDistribution(filtered);
  }

  renderBarChart(data) {
    const margin = {top: 40, right: 30, bottom: 100, left: 60};
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Calculate average MPG by manufacturer
    const avgMPG = d3.rollups(
      data,
      v => d3.mean(v, d => d.MPG),
      d => d.Manufacturer
    ).map(([Manufacturer, MPG]) => ({ Manufacturer, MPG }));

    // Clear and create SVG
    const container = d3.select("#bar-chart");
    container.selectAll("*").remove();
    
    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add sorting controls
    const controls = container.append("div")
      .attr("class", "chart-controls")
      .style("margin-bottom", "10px");

    controls.append("button")
      .text("Sort A-Z")
      .on("click", () => {
        avgMPG.sort((a,b) => a.Manufacturer.localeCompare(b.Manufacturer));
        updateBars();
      });

    controls.append("button")
      .text("Sort by MPG")
      .on("click", () => {
        avgMPG.sort((a,b) => b.MPG - a.MPG);
        updateBars();
      });

    // Create scales
    const x = d3.scaleBand()
      .domain(avgMPG.map(d => d.Manufacturer))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(avgMPG, d => d.MPG)]).nice()
      .range([height, 0]);

    // Add bars
    svg.selectAll(".bar")
      .data(avgMPG)
      .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.Manufacturer))
      .attr("y", d => y(d.MPG))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.MPG))
      .attr("fill", "steelblue")
      .on("click", (event, d) => {
        this.selectedPoints = new Set(
          this.data.filter(car => car.Manufacturer === d.Manufacturer).map(c => c.Car)
        );
        this.updateVisualizations();
      });

    // Add axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-0.8em")
      .attr("dy", "0.15em")
      .attr("transform", "rotate(-45)");

    svg.append("g")
      .call(d3.axisLeft(y));

    // Add labels
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .style("text-anchor", "middle")
      .text("Average MPG");

    function updateBars() {
      x.domain(avgMPG.map(d => d.Manufacturer));
      svg.selectAll(".bar")
        .data(avgMPG)
        .transition()
        .duration(500)
        .attr("x", d => x(d.Manufacturer))
        .attr("y", d => y(d.MPG))
        .attr("height", d => height - y(d.MPG));
      
      svg.select(".x-axis").call(d3.axisBottom(x));
    }
  }

  renderScatterPlot(data) {
    const margin = {top: 40, right: 30, bottom: 70, left: 60};
    const width = 600 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const container = d3.select("#scatter-plot");
    container.selectAll("*").remove();
    
    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.Horsepower)).nice()
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.MPG)).nice()
      .range([height, 0]);

    // Color scale
    const color = d3.scaleOrdinal()
      .domain(["American", "European", "Japanese"])
      .range(["#1f77b4", "#ff7f0e", "#2ca02c"]);

    // Add dots
    svg.selectAll(".dot")
      .data(data)
      .join("circle")
      .attr("class", "dot data-point")
      .attr("cx", d => x(d.Horsepower))
      .attr("cy", d => y(d.MPG))
      .attr("r", 5)
      .attr("fill", d => color(d.Origin))
      .classed("highlighted", d => this.selectedPoints.has(d.Car))
      .on("click", (event, d) => {
        this.selectedPoints = new Set([d.Car]);
        this.updateVisualizations();
      });

    // Add brush
    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on("brush", (event) => {
        if (!event.selection) return;
        const [[x0, y0], [x1, y1]] = event.selection;
        this.selectedPoints = new Set(
          data.filter(d => 
            x(d.Horsepower) >= x0 && x(d.Horsepower) <= x1 &&
            y(d.MPG) >= y0 && y(d.MPG) <= y1
          ).map(d => d.Car)
        );
        this.updateVisualizations();
      })
      .on("end", (event) => {
        if (!event.selection) {
          this.selectedPoints.clear();
          this.updateVisualizations();
        }
      });

    svg.append("g")
      .attr("class", "brush")
      .call(brush);

    // Add axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    svg.append("g")
      .call(d3.axisLeft(y));

    // Add labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10)
      .style("text-anchor", "middle")
      .text("Horsepower");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .style("text-anchor", "middle")
      .text("MPG");

    // Add legend
    const legend = svg.selectAll(".legend")
      .data(color.domain())
      .join("g")
      .attr("class", "legend")
      .attr("transform", (d,i) => `translate(0,${i * 20})`);

    legend.append("rect")
      .attr("x", width - 18)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", color);

    legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text(d => d);
  }

  renderWeightDistribution(data) {
    const margin = {top: 40, right: 30, bottom: 70, left: 60};
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const container = d3.select("#weight-distribution");
    container.selectAll("*").remove();
    
    const svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Group data by origin
    const groups = d3.groups(data, d => d.Origin);
    const allWeights = data.map(d => d.Weight);
    
    // Create scales
    const x = d3.scaleBand()
      .domain(groups.map(d => d[0]))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(allWeights)]).nice()
      .range([height, 0]);

    // Color scale
    const color = d3.scaleOrdinal()
      .domain(["American", "European", "Japanese"])
      .range(["#1f77b4", "#ff7f0e", "#2ca02c"]);

    // Calculate summary statistics for each group
    groups.forEach(([origin, values]) => {
      const weights = values.map(d => d.Weight).sort(d3.ascending);
      const q1 = d3.quantile(weights, 0.25);
      const median = d3.quantile(weights, 0.5);
      const q3 = d3.quantile(weights, 0.75);
      const iqr = q3 - q1;
      const min = Math.max(weights[0], q1 - 1.5 * iqr);
      const max = Math.min(weights[weights.length - 1], q3 + 1.5 * iqr);

      // Draw box plot
      const xPos = x(origin) + x.bandwidth() / 2;
      
      // Main box
      svg.append("rect")
        .attr("x", xPos - 15)
        .attr("y", y(q3))
        .attr("width", 30)
        .attr("height", y(q1) - y(q3))
        .attr("fill", color(origin))
        .attr("stroke", "#000")
        .attr("class", "data-point")
        .classed("highlighted", d => 
          values.some(v => this.selectedPoints.has(v.Car)));

      // Median line
      svg.append("line")
        .attr("x1", xPos - 15)
        .attr("x2", xPos + 15)
        .attr("y1", y(median))
        .attr("y2", y(median))
        .attr("stroke", "#000")
        .attr("stroke-width", 2);

      // Whiskers
      svg.append("line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", y(min))
        .attr("y2", y(max))
        .attr("stroke", "#000");

      // Whisker caps
      svg.append("line")
        .attr("x1", xPos - 10)
        .attr("x2", xPos + 10)
        .attr("y1", y(min))
        .attr("y2", y(min))
        .attr("stroke", "#000");

      svg.append("line")
        .attr("x1", xPos - 10)
        .attr("x2", xPos + 10)
        .attr("y1", y(max))
        .attr("y2", y(max))
        .attr("stroke", "#000");

      // Outliers
      const outliers = weights.filter(w => w < min || w > max);
      svg.selectAll(".outlier")
        .data(outliers)
        .join("circle")
        .attr("cx", xPos)
        .attr("cy", d => y(d))
        .attr("r", 3)
        .attr("fill", color(origin))
        .attr("stroke", "#000")
        .attr("class", "data-point")
        .classed("highlighted", d => 
          values.some(v => this.selectedPoints.has(v.Car)));
    });

    // Add axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    svg.append("g")
      .call(d3.axisLeft(y));

    // Add labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10)
      .style("text-anchor", "middle")
      .text("Vehicle Origin");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .style("text-anchor", "middle")
      .text("Weight (lbs)");

    // Add title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .style("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Weight Distribution by Origin");
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new CarVisualization();
});
