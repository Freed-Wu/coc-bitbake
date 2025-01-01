#!/bin/bash

# Tag: yocto-5.1.1
BITBAKE_DOCS_COMMIT=9602a684568910fd333ffce907fa020ad3661c26
    The previous commit fixed persist_data's context manager to close the
    (cherry picked from commit 61f803c7d92a012b62837b0cdae4789a394b260e)
# Tag: yocto-5.1.1
YOCTO_DOCS_COMMIT=8288c8cae7fe7303e89d8ed286de91fc26ce6cc3
    (cherry picked from commit ed49067f172637d38d470a864feed2a02bd84c66)

BITBAKE_DOCS_LIST="bitbake-user-manual-metadata.rst bitbake-user-manual-ref-variables.rst"
YOCTO_DOCS_LIST=" tasks.rst variables.rst"

set -e
cd "$(dirname "$(readlink -f "$0")")/.."

mkdir -p server/resources/docs
#  Bitbake docs
git clone --depth 1 --filter=blob:none --sparse https://github.com/openembedded/bitbake.git
cd bitbake
git sparse-checkout set doc/bitbake-user-manual/
git fetch origin
git checkout $BITBAKE_DOCS_COMMIT
cd doc/bitbake-user-manual/
mv $BITBAKE_DOCS_LIST  ../../../server/resources/docs
cd ../../../
rm -rf bitbake

# Yocto docs
git clone --depth 1 --filter=blob:none --sparse https://git.yoctoproject.org/yocto-docs
cd yocto-docs
git sparse-checkout set documentation/ref-manual
git fetch origin
git checkout $YOCTO_DOCS_COMMIT
cd documentation/ref-manual
mv $YOCTO_DOCS_LIST ../../../server/resources/docs
cd ../../../
rm -rf yocto-docs

# This line is added to let the last task in tasks.rst get matched by the regex in doc scanner
echo "\n.. _ref-dummy-end-for-matching-do-validate-branches:" >> server/resources/docs/tasks.rst
