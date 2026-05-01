#!/bin/bash

# Tag: yocto-5.2.4
COMMIT=d0b46a6624ec9c61c47270745dd0b2d5abbe6ac1

set -e

mkdir -p resources/poky
cd resources/poky
git clone https://github.com/yoctoproject/poky.git .
git fetch origin
git checkout $COMMIT

