import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import Navbar from "./component/NavBar";
import Home from "./pages/Home";
// import Footer from "./component/Footer";

import ThoughtOfSquare from "./pages/ThoughtOfSquare";
import VictimOfSniper from "./pages/VictimOfSniper";
import OpeningTree from "./pages/OpeningTree";

function App() {
  return (
    <Router>
      <div className="font-body-md text-body-md h-screen flex flex-col bg-[#0A0A0A] text-[#eae1d4] overflow-hidden">

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/thought-of-square" element={<ThoughtOfSquare />} />
          <Route path="/victim-of-sniper" element={<VictimOfSniper />} />
          <Route path="/opening-tree" element={<OpeningTree />} />
        </Routes>

      </div>
    </Router>
  );
}

export default App;
