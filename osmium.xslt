<video id="bgcontainer" class='video' autoplay></video>
    
    <svg style="position: absolute; width: 0; height: 0;" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="crystal-distortion">
            <feTurbulence baseFrequency="0.008" numOctaves="9" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="48"/>
        </filter>
        <filter id="crystal-distortion-hover">
            <feTurbulence baseFrequency="0.008" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="16"/>
            <feColorMatrix type="saturate" values="1.025"/>
            <feColorMatrix type="hueRotate" values="12"/>
        </filter>
        <filter id="crystal-distortion-hover-button">
            <feTurbulence baseFrequency="0.008" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="24"/>
            <feColorMatrix type="saturate" values="1.05"/>
            <feColorMatrix type="hueRotate" values="12"/>
        </filter>
        <filter id="crystal-distortion-plus">
            <feTurbulence baseFrequency="0.008" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="72"/>
            <feColorMatrix type="saturate" values="1.05"/>
        </filter>
        <filter id="crystal-distortion-plus-two">
            <feTurbulence baseFrequency="0.016" numOctaves="6" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="96"/>
            <feColorMatrix type="saturate" values="0.85"/>
        </filter>
        <filter id="crystal-distortion-plus-three">
            <feTurbulence baseFrequency="0.016" numOctaves="6" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="144"/>
            <feColorMatrix type="saturate" values="0.85"/>
        </filter>
        <filter id="crystal-distortion-minus">
            <feTurbulence baseFrequency="0.008" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="24"/>
            <feColorMatrix type="saturate" values="1.05"/>
        </filter>
      </defs>
    </svg>